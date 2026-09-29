import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MCP_APPS_METHODS, type RpcLogEvent } from '@studio/shared';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { executeRun, type RunContext, type RunPage } from './run-executor.js';
import type { ActiveTarget, TestRun } from './test-plan.js';

const run: TestRun = {
  widget: 'kpi',
  scenario: 'error',
  theme: 'dark',
  query: 'widget=kpi&scenario=error&theme=dark',
  screenshot: 'kpi/error.dark.png',
};

const handshakeLog: RpcLogEvent[] = [
  { ts: 1, direction: 'widget→host', kind: 'request', id: 1, method: MCP_APPS_METHODS.uiInitialize, payload: {} },
  { ts: 2, direction: 'host→widget', kind: 'response', id: 1, payload: {} },
  { ts: 3, direction: 'widget→host', kind: 'notification', method: MCP_APPS_METHODS.initialized, payload: {} },
];

/** Scriptable stand-in for a Playwright page. */
function fakePage(overrides: Partial<RunPage> = {}): RunPage & { closed: boolean; visited: string[] } {
  const page = {
    closed: false,
    visited: [] as string[],
    async goto(url: string) {
      page.visited.push(url);
    },
    async waitForLog() {},
    async settle() {},
    async getLog() {
      return handshakeLog;
    },
    async getActive(): Promise<ActiveTarget | undefined> {
      return { widget: 'kpi', scenario: 'error', theme: 'dark' };
    },
    async screenshotViewport(file: string) {
      await fs.writeFile(file, 'png');
    },
    async close() {
      page.closed = true;
    },
    ...overrides,
  };
  return page;
}

let outDir: string;
let ctx: RunContext;

beforeEach(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-run-'));
  ctx = { url: (r) => `http://studio/?${r.query}`, outDir };
});

afterEach(() => fs.rm(outDir, { recursive: true, force: true }));

describe('executeRun', () => {
  it('passes a run that handshakes and renders the requested target', async () => {
    const page = fakePage();
    const result = await executeRun(page, run, ctx);
    expect(result).toMatchObject({ widget: 'kpi', scenario: 'error', theme: 'dark', ok: true, failures: [] });
    expect(result.screenshot).toBe('kpi/error.dark.png');
    expect(page.visited).toEqual(['http://studio/?widget=kpi&scenario=error&theme=dark']);
    expect(page.closed).toBe(true);
  });

  it('turns a navigation error into a failed run and still closes the page', async () => {
    const page = fakePage({
      goto: async () => {
        throw new Error('net::ERR_ABORTED');
      },
    });
    const result = await executeRun(page, run, ctx);
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('net::ERR_ABORTED');
    expect(page.closed).toBe(true);
  });

  it('fails a run whose studio rendered another scenario', async () => {
    const page = fakePage({ getActive: async () => ({ widget: 'kpi', scenario: 'default', theme: 'dark' }) });
    const result = await executeRun(page, run, ctx);
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('instead of kpi/error [dark]');
  });

  it('fails when the viewport never rendered', async () => {
    const page = fakePage({
      screenshotViewport: async () => {
        throw new Error('locator timeout');
      },
    });
    const result = await executeRun(page, run, ctx);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain('widget viewport never rendered');
  });

  describe('snapshots', () => {
    const snapshotOpts = (dir: string, update: boolean) => ({ dir, update, threshold: 0.1, maxDiffPixels: 0 });

    it('writes the baseline of a passing run under --update-snapshots', async () => {
      const dir = path.join(outDir, 'snaps');
      const result = await executeRun(fakePage(), run, { ...ctx, snapshots: snapshotOpts(dir, true) });
      expect(result.ok).toBe(true);
      expect(await fs.readFile(path.join(dir, 'kpi/error.dark.png'), 'utf8')).toBe('png');
    });

    it('does not bless a failing run as the baseline', async () => {
      const dir = path.join(outDir, 'snaps');
      const baseline = path.join(dir, 'kpi/error.dark.png');
      await fs.mkdir(path.dirname(baseline), { recursive: true });
      await fs.writeFile(baseline, 'old');
      const page = fakePage({ getLog: async () => handshakeLog.slice(0, 2) });
      const result = await executeRun(page, run, { ...ctx, snapshots: snapshotOpts(dir, true) });
      expect(result.ok).toBe(false);
      expect(result.failures.join('\n')).toContain('baseline not updated');
      expect(await fs.readFile(baseline, 'utf8')).toBe('old');
    });

    it('turns a comparison crash (unreadable screenshot) into a failed run', async () => {
      const dir = path.join(outDir, 'snaps');
      await fs.mkdir(path.join(dir, 'kpi'), { recursive: true });
      // A valid baseline, so the comparison gets to decoding the (non-PNG) screenshot and throws.
      await fs.writeFile(path.join(dir, 'kpi/error.dark.png'), PNG.sync.write(new PNG({ width: 1, height: 1 })));
      const page = fakePage();
      const result = await executeRun(page, run, { ...ctx, snapshots: snapshotOpts(dir, false), compare: true });
      expect(result.ok).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(page.closed).toBe(true);
    });
  });
});
