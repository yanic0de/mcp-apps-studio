import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { RpcLogEvent } from '@studio/shared';
import { discoverStories } from './discover.js';
import { createStudioServer, generateToken } from './server.js';
import { buildTestPlan, evaluateRun, type RunResult, type Theme } from './test-plan.js';

export interface StoryTestOptions {
  rootDir: string;
  studioDist: string;
  outDir: string;
  themes: Theme[];
  onResult?: (result: RunResult) => void;
}

/** Thrown when Chromium for playwright-core is not installed. */
export class NoBrowserError extends Error {}

const HANDSHAKE_TIMEOUT_MS = 10_000;
/** Lets delayed/loading scenarios reach their visible state before the screenshot. */
const SETTLE_MS = 300;

/**
 * Serves the studio locally and drives headless Chromium through the story matrix via deep links,
 * reading the trace through the studio's read-only `window.__mcpStudio.getLog()` hook.
 */
export async function runStoryTests(opts: StoryTestOptions): Promise<RunResult[]> {
  const manifest = await discoverStories(opts.rootDir);
  const plan = buildTestPlan(manifest, opts.themes);
  const token = generateToken();
  const server = createStudioServer({ studioDist: opts.studioDist, getManifest: async () => manifest, token });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const { chromium } = await import('playwright-core');
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch();
  } catch (err) {
    server.close();
    throw new NoBrowserError(err instanceof Error ? err.message : String(err));
  }

  const results: RunResult[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const run of plan) {
      const page = await context.newPage();
      await page.goto(`${base}/?token=${token}&${run.query}`);
      await page
        .waitForFunction(
          (method) => {
            const hook = (globalThis as { __mcpStudio?: { getLog(): { method?: string }[] } }).__mcpStudio;
            return hook?.getLog().some((e) => e.method === method) ?? false;
          },
          'ui/notifications/initialized',
          { timeout: HANDSHAKE_TIMEOUT_MS },
        )
        .catch(() => {}); // evaluateRun reports the missing step
      await page.waitForTimeout(SETTLE_MS);
      const log = await page.evaluate(
        () => (globalThis as { __mcpStudio?: { getLog(): unknown[] } }).__mcpStudio?.getLog() ?? [],
      );
      const verdict = evaluateRun(log as RpcLogEvent[]);
      const file = path.join(opts.outDir, run.screenshot);
      await fs.mkdir(path.dirname(file), { recursive: true });
      try {
        await page.locator('[data-testid="viewport"]').screenshot({ path: file });
      } catch {
        verdict.ok = false;
        verdict.failures.push('widget viewport never rendered');
      }
      const result: RunResult = {
        widget: run.widget,
        scenario: run.scenario,
        theme: run.theme,
        ...verdict,
        screenshot: run.screenshot,
      };
      results.push(result);
      opts.onResult?.(result);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  await fs.mkdir(opts.outDir, { recursive: true });
  await fs.writeFile(path.join(opts.outDir, 'report.json'), `${JSON.stringify({ results }, null, 2)}\n`);
  return results;
}
