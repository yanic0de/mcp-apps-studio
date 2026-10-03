import path from 'node:path';
import { MCP_APPS_METHODS, type RpcLogEvent, type WidgetManifestEntry } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { buildTestPlan, checkTarget, evaluateRun, safeSegment, summarize } from './test-plan.js';

const widget = (id: string, scenarios: string[]): WidgetManifestEntry => ({
  id,
  title: id,
  html: '',
  scenarios: Object.fromEntries(scenarios.map((s) => [s, { mocks: {} }])),
});

describe('buildTestPlan', () => {
  it('crosses widgets × non-live scenarios × themes in manifest order', () => {
    const plan = buildTestPlan(
      [widget('kpi', ['default', 'error', 'live']), widget('table', ['empty'])],
      ['light', 'dark'],
    );
    expect(plan.map((r) => `${r.widget}/${r.scenario}.${r.theme}`)).toEqual([
      'kpi/default.light',
      'kpi/default.dark',
      'kpi/error.light',
      'kpi/error.dark',
      'table/empty.light',
      'table/empty.dark',
    ]);
  });

  it('builds the deep-link query and the screenshot path', () => {
    const [run] = buildTestPlan([widget('kpi', ['default'])], ['dark']);
    expect(run?.query).toBe('widget=kpi&scenario=default&theme=dark');
    expect(run?.screenshot).toBe('kpi/default.dark.png');
  });

  it("carries the scenario's interaction steps into its runs", () => {
    const entry = widget('kpi', ['default']);
    const steps = [{ click: 'button' }];
    entry.scenarios = { default: { mocks: {}, steps } };
    expect(buildTestPlan([entry], ['light']).map((r) => r.steps)).toEqual([steps]);
    expect(buildTestPlan([widget('kpi', ['default'])], ['light'])[0]?.steps).toBeUndefined();
  });
});

const ev = (e: Partial<RpcLogEvent>): RpcLogEvent => ({
  ts: 0,
  direction: 'widget→host',
  kind: 'request',
  payload: {},
  ...e,
});
const handshake: RpcLogEvent[] = [
  ev({ kind: 'request', method: MCP_APPS_METHODS.uiInitialize, id: 'w1' }),
  ev({ direction: 'host→widget', kind: 'response', id: 'w1' }),
  ev({ kind: 'notification', method: MCP_APPS_METHODS.initialized }),
];

describe('evaluateRun', () => {
  it('passes a clean handshake', () => {
    expect(evaluateRun(handshake)).toEqual({ ok: true, failures: [] });
  });

  it('fails on invalid events, quoting the error', () => {
    const r = evaluateRun([...handshake, ev({ kind: 'invalid', error: 'Unsupported notification: wat' })]);
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual(['invalid message: Unsupported notification: wat']);
  });

  it('names each missing handshake step', () => {
    expect(evaluateRun([]).failures).toEqual([
      'widget never sent ui/initialize',
      'host never answered ui/initialize',
      'widget never sent ui/notifications/initialized',
    ]);
    expect(evaluateRun(handshake.slice(0, 2)).failures).toEqual(['widget never sent ui/notifications/initialized']);
  });
});

describe('summarize', () => {
  it('prints one line per run and a total', () => {
    const text = summarize([
      { widget: 'kpi', scenario: 'default', theme: 'light', ok: true, failures: [] },
      { widget: 'kpi', scenario: 'error', theme: 'dark', ok: false, failures: ['boom'] },
    ]);
    expect(text).toBe('  ✓ kpi/default [light]\n  ✗ kpi/error [dark]\n      boom\n\n1 passed, 1 failed');
  });
});

describe('checkTarget', () => {
  const run = { widget: 'kpi', scenario: 'error', theme: 'dark' as const };

  it('passes when the studio renders the requested target', () => {
    expect(checkTarget(run, { widget: 'kpi', scenario: 'error', theme: 'dark' })).toEqual([]);
  });

  it('names requested and rendered target on a mismatch', () => {
    const [reason] = checkTarget(run, { widget: 'kpi', scenario: 'default', theme: 'dark' });
    expect(reason).toContain('kpi/error [dark]');
    expect(reason).toContain('kpi/default [dark]');
  });

  it('fails when the studio reports nothing (no widget, or an old studio without the hook)', () => {
    expect(checkTarget(run, { widget: null, scenario: 'default', theme: 'light' })).toHaveLength(1);
    expect(checkTarget(run, undefined)).toHaveLength(1);
  });
});

describe('artifact paths', () => {
  it('safeSegment keeps sane names and neutralizes the rest', () => {
    expect(safeSegment('default')).toBe('default');
    expect(safeSegment('recorded-1.v2')).toBe('recorded-1.v2');
    expect(safeSegment('a b/c')).toBe('a_b_c');
    expect(safeSegment('..')).toBe('_');
    expect(safeSegment('.')).toBe('_');
    expect(safeSegment('')).toBe('_');
  });

  it('keeps every screenshot inside the output directory', () => {
    const plan = buildTestPlan([widget('../../evil', ['../../etc/x', 'ok'])], ['light']);
    const out = path.resolve('/tmp/out');
    for (const run of plan) {
      expect(run.screenshot.split('/')).not.toContain('..');
      expect(path.resolve(out, run.screenshot).startsWith(out + path.sep)).toBe(true);
    }
    // the real names still drive the deep link
    expect(plan[0]?.query).toContain(encodeURIComponent('../../etc/x').replace(/%20/g, '+'));
  });

  it('keeps nested ids from colliding basenames as folders', () => {
    const [run] = buildTestPlan([widget('a/kpi', ['default'])], ['dark']);
    expect(run?.screenshot).toBe('a/kpi/default.dark.png');
  });
});
