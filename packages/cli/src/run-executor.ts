import fs from 'node:fs/promises';
import path from 'node:path';
import { MCP_APPS_METHODS, type RpcLogEvent } from '@studio/shared';
import { type ActiveTarget, checkTarget, evaluateRun, type RunResult, type TestRun } from './test-plan.js';
import { compareWithBaseline, type VisualOptions } from './visual.js';

/** The slice of a browser page one run needs; the runner adapts Playwright to it, tests use a fake. */
export interface RunPage {
  goto(url: string): Promise<void>;
  /** Resolves when the trace has an entry with `method`, or after `timeoutMs` (never rejects on timeout). */
  waitForLog(method: string, timeoutMs: number): Promise<void>;
  settle(ms: number): Promise<void>;
  getLog(): Promise<RpcLogEvent[]>;
  /** `window.__mcpStudio.getActive()`; `undefined` when the hook is missing. */
  getActive(): Promise<ActiveTarget | undefined>;
  /** PNG of the widget viewport; rejects when it never rendered. */
  screenshotViewport(file: string): Promise<void>;
  close(): Promise<void>;
}

export interface RunContext {
  /** Studio deep link for a run (token included). */
  url: (run: TestRun) => string;
  outDir: string;
  /** Visual baselines: written with `update` (passing runs only), compared when `compare`. */
  snapshots?: { dir: string; update: boolean } & VisualOptions;
  compare?: boolean;
  handshakeTimeoutMs?: number;
  /** Lets delayed/loading scenarios reach their visible state before the screenshot. */
  settleMs?: number;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
const relative = (from: string, file: string) => path.relative(from, file).split(path.sep).join('/');

/**
 * Plays one run and returns its verdict. Never throws: a crash becomes a failed result, so one broken
 * story cannot cost the rest of the matrix or the report, and the page is always closed.
 */
export async function executeRun(page: RunPage, run: TestRun, ctx: RunContext): Promise<RunResult> {
  const result: RunResult = {
    widget: run.widget,
    scenario: run.scenario,
    theme: run.theme,
    ok: false,
    failures: [],
  };
  try {
    await page.goto(ctx.url(run));
    await page.waitForLog(MCP_APPS_METHODS.initialized, ctx.handshakeTimeoutMs ?? 10_000);
    await page.settle(ctx.settleMs ?? 300);
    result.failures.push(...checkTarget(run, await page.getActive()));
    result.failures.push(...evaluateRun(await page.getLog()).failures);

    const file = path.join(ctx.outDir, run.screenshot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    let captured = true;
    try {
      await page.screenshotViewport(file);
      result.screenshot = run.screenshot;
    } catch {
      captured = false;
      result.failures.push('widget viewport never rendered');
    }

    const snapshots = ctx.snapshots;
    if (snapshots && captured) {
      const baseline = path.join(snapshots.dir, run.screenshot);
      if (snapshots.update) {
        // A broken run must not become the reference the next runs are judged against.
        if (result.failures.length > 0) {
          result.failures.push('baseline not updated: run failed');
        } else {
          await fs.mkdir(path.dirname(baseline), { recursive: true });
          await fs.copyFile(file, baseline);
        }
      } else if (ctx.compare) {
        result.baseline = relative(ctx.outDir, baseline);
        const visual = await compareWithBaseline(file, baseline, snapshots);
        if (!visual.ok) {
          result.failures.push(visual.reason ?? 'visual change');
          if (visual.diffImage) result.diff = relative(ctx.outDir, visual.diffImage);
        }
      }
    }
  } catch (err) {
    result.failures.push(`run crashed: ${errorMessage(err)}`);
  } finally {
    await page.close().catch(() => {});
  }
  result.ok = result.failures.length === 0;
  return result;
}
