import { MCP_APPS_METHODS, type RpcLogEvent, type WidgetManifestEntry } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { buildTestPlan, evaluateRun, summarize } from './test-plan.js';

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
