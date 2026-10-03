import fs from 'node:fs/promises';
import path from 'node:path';
import { MCP_APPS_METHODS, type Step } from '@studio/shared';
import { type ActionStep, isAction, matchStep, stepSummary, type TraceEvent, unmetReason } from './steps.js';
import { type ActiveTarget, checkTarget, evaluateRun, type RunResult, type TestRun } from './test-plan.js';
import { compareWithBaseline, type VisualOptions } from './visual.js';

/** The slice of a browser page one run needs; the runner adapts Playwright to it, tests use a fake. */
export interface RunPage {
  goto(url: string): Promise<void>;
  /** Resolves when the trace has an entry with `method`, or after `timeoutMs` (never rejects on timeout). */
  waitForLog(method: string, timeoutMs: number): Promise<void>;
  settle(ms: number): Promise<void>;
  /** The studio trace; its entries carry `seq`, the stable key step expectations consume by. */
  getLog(): Promise<TraceEvent[]>;
  /** `window.__mcpStudio.getActive()`; `undefined` when the hook is missing. */
  getActive(): Promise<ActiveTarget | undefined>;
  /** Performs an action step inside the widget iframe; rejects when it cannot within `timeoutMs`. */
  act(step: ActionStep, timeoutMs: number): Promise<void>;
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

const STEP_TIMEOUT_MS = 5_000;
const POLL_MS = 50;

/**
 * Plays the steps in order; returns the first failure as `step <n> (<summary>): <cause>`, or `undefined`.
 * Expectations poll the trace and each consumes the earliest matching message no earlier one took.
 */
async function playSteps(page: RunPage, steps: Step[]): Promise<string | undefined> {
  const consumed = new Set<number>();
  for (const [i, step] of steps.entries()) {
    const timeoutMs = step.timeoutMs ?? STEP_TIMEOUT_MS;
    const fail = (cause: string) => `step ${i + 1} (${stepSummary(step)}): ${cause}`;
    if (isAction(step)) {
      try {
        await page.act(step, timeoutMs);
      } catch (err) {
        return fail(errorMessage(err).split('\n')[0] ?? '');
      }
      continue;
    }
    let log: TraceEvent[] = [];
    let match: number | undefined;
    // Counted polls rather than a wall clock: deterministic with a fake page whose settle is instant.
    for (let polls = Math.ceil(timeoutMs / POLL_MS); ; polls--) {
      log = await page.getLog();
      match = matchStep(log, step, consumed);
      if (match !== undefined || polls <= 0) break;
      await page.settle(POLL_MS);
    }
    if (match === undefined) return fail(unmetReason(log, step, timeoutMs));
    consumed.add(match);
  }
  return undefined;
}
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
    if (run.steps?.length && result.failures.length === 0) {
      const stepFailure = await playSteps(page, run.steps);
      if (stepFailure) result.failures.push(stepFailure);
    }
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
