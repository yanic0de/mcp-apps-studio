import fs from 'node:fs/promises';
import path from 'node:path';
import type { DiscoveryError, RpcLogEvent } from '@studio/shared';
import type { Page } from 'playwright-core';
import { discoverStories } from './discover.js';
import { renderHtmlReport, renderMarkdownSummary } from './report.js';
import { executeRun, type RunContext, type RunPage } from './run-executor.js';
import { createStudioServer, generateToken, listenLoopback } from './server.js';
import { type ActiveTarget, buildTestPlan, type RunResult, type Theme } from './test-plan.js';
import type { VisualOptions } from './visual.js';

export interface StoryTestOptions {
  rootDir: string;
  studioDist: string;
  outDir: string;
  themes: Theme[];
  /** Visual baselines: written with `update`, compared when the directory exists. */
  snapshots?: { dir: string; update: boolean } & VisualOptions;
  onResult?: (result: RunResult) => void;
}

/** Thrown when Chromium for playwright-core is not installed. */
export class NoBrowserError extends Error {}

const HANDSHAKE_TIMEOUT_MS = 10_000;
const SETTLE_MS = 300;

/** The studio's read-only automation hook (`window.__mcpStudio`); `getActive` is missing in older studios. */
interface StudioHook {
  getLog(): RpcLogEvent[];
  getActive?(): ActiveTarget;
}
type HookGlobal = { __mcpStudio?: StudioHook };

/** Adapts a Playwright page to what one run needs. */
function playwrightRunPage(page: Page): RunPage {
  return {
    goto: async (url) => {
      await page.goto(url);
    },
    waitForLog: async (method, timeout) => {
      await page
        // Evaluated in the browser: no closures over Node code.
        .waitForFunction(
          (m) => (globalThis as HookGlobal).__mcpStudio?.getLog().some((e) => e.method === m) ?? false,
          method,
          { timeout },
        )
        .catch(() => {}); // the run's evaluation reports the missing step
    },
    settle: (ms) => page.waitForTimeout(ms),
    getLog: () => page.evaluate(() => (globalThis as HookGlobal).__mcpStudio?.getLog() ?? []),
    getActive: () => page.evaluate(() => (globalThis as HookGlobal).__mcpStudio?.getActive?.()),
    act: async (step, timeout) => {
      // Playwright reaches the sandboxed null-origin frame over CDP: the sandbox itself stays untouched.
      const frame = page.frameLocator('[data-testid="viewport"] iframe');
      if ('click' in step) await frame.locator(step.click).click({ timeout });
      else if ('fill' in step) await frame.locator(step.fill).fill(step.value, { timeout });
      else await frame.locator(step.on ?? 'body').press(step.press, { timeout });
    },
    screenshotViewport: async (file) => {
      await page.locator('[data-testid="viewport"]').screenshot({ path: file });
    },
    close: () => page.close(),
  };
}

/**
 * Serves the studio locally and drives headless Chromium through the story matrix via deep links,
 * reading the trace through the studio's read-only `window.__mcpStudio.getLog()` hook.
 */
export async function runStoryTests(
  opts: StoryTestOptions,
): Promise<{ results: RunResult[]; errors: DiscoveryError[] }> {
  const manifest = await discoverStories(opts.rootDir);
  const plan = buildTestPlan(manifest.widgets, opts.themes);
  const token = generateToken();
  const server = createStudioServer({ studioDist: opts.studioDist, getManifest: async () => manifest, token });
  const base = `http://127.0.0.1:${await listenLoopback(server, 0)}`;

  const { chromium } = await import('playwright-core');
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch();
  } catch (err) {
    server.close();
    throw new NoBrowserError(err instanceof Error ? err.message : String(err));
  }

  const snapshots = opts.snapshots;
  const compare =
    snapshots &&
    !snapshots.update &&
    (await fs.stat(snapshots.dir).then(
      (st) => st.isDirectory(),
      () => false,
    ));
  const results: RunResult[] = [];
  const ctx: RunContext = {
    url: (run) => `${base}/?token=${token}&${run.query}`,
    outDir: opts.outDir,
    snapshots,
    compare: Boolean(compare),
    handshakeTimeoutMs: HANDSHAKE_TIMEOUT_MS,
    settleMs: SETTLE_MS,
  };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const run of plan) {
      const result = await context.newPage().then(
        (page) => executeRun(playwrightRunPage(page), run, ctx),
        (err: unknown): RunResult => ({
          widget: run.widget,
          scenario: run.scenario,
          theme: run.theme,
          ok: false,
          failures: [`run crashed: ${err instanceof Error ? err.message : String(err)}`],
        }),
      );
      results.push(result);
      opts.onResult?.(result);
    }
  } finally {
    await browser.close();
    server.close();
  }

  await fs.mkdir(opts.outDir, { recursive: true });
  await fs.writeFile(
    path.join(opts.outDir, 'report.json'),
    `${JSON.stringify({ results, errors: manifest.errors }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(opts.outDir, 'report.html'), renderHtmlReport(results, manifest.errors));
  // GitHub Actions job summary, when running there.
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, renderMarkdownSummary(results, manifest.errors));
  }
  return { results, errors: manifest.errors };
}
