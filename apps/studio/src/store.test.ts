import { defaultHostContext, type WidgetManifestEntry } from '@studio/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOG_LIMIT, useStudioStore } from './store.js';
import { deviceContext } from './viewport.js';

const initial = useStudioStore.getState();

beforeEach(() => useStudioStore.setState(initial, true));

const widgets: WidgetManifestEntry[] = [
  {
    id: 'kpi',
    title: 'KPI Card',
    html: '<html>kpi</html>',
    scenarios: {
      default: { mocks: {} },
      error: { mocks: { t: { kind: 'error', message: 'x' } } },
    },
  },
  {
    id: 'table',
    title: 'Data Table',
    html: '<html>table</html>',
    scenarios: { main: { mocks: {} } },
  },
];

describe('studio store', () => {
  it('starts with default context plus the desktop preset, no widgets, empty log', () => {
    const s = useStudioStore.getState();
    expect(s.device).toBe('desktop');
    expect(s.hostContext).toEqual({ ...defaultHostContext, ...deviceContext('desktop') });
    expect(s.widgets).toEqual([]);
    expect(s.activeWidgetId).toBeNull();
    expect(s.log).toEqual([]);
  });

  it('setWidgets selects the first widget and its first scenario', () => {
    useStudioStore.getState().setWidgets(widgets);
    const s = useStudioStore.getState();
    expect(s.activeWidgetId).toBe('kpi');
    expect(s.scenario).toBe('default');
  });

  it('setActiveWidget switches widget, resets scenario, clears log', () => {
    useStudioStore.getState().setWidgets(widgets);
    useStudioStore.getState().appendLog({ ts: 1, direction: 'widget→host', kind: 'request', payload: {} });
    useStudioStore.getState().setActiveWidget('table');
    const s = useStudioStore.getState();
    expect(s.activeWidgetId).toBe('table');
    expect(s.scenario).toBe('main');
    expect(s.log).toEqual([]);
  });

  it('setScenario clears the log', () => {
    useStudioStore.getState().setWidgets(widgets);
    useStudioStore.getState().appendLog({ ts: 1, direction: 'widget→host', kind: 'request', payload: {} });
    useStudioStore.getState().setScenario('error');
    expect(useStudioStore.getState().scenario).toBe('error');
    expect(useStudioStore.getState().log).toEqual([]);
  });

  it('merges host context patches', () => {
    useStudioStore.getState().setHostContext({ theme: 'dark' });
    expect(useStudioStore.getState().hostContext).toMatchObject({ theme: 'dark', locale: 'en' });
  });

  it('caps the log at LOG_LIMIT entries, dropping the oldest', () => {
    const { appendLog } = useStudioStore.getState();
    for (let i = 0; i < LOG_LIMIT + 10; i++) {
      appendLog({ ts: i, direction: 'widget→host', kind: 'request', payload: {} });
    }
    const log = useStudioStore.getState().log;
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]?.ts).toBe(10);
    expect(log[log.length - 1]?.ts).toBe(LOG_LIMIT + 9);
  });

  it('gives every entry a unique seq that survives trimming', () => {
    const { appendLog } = useStudioStore.getState();
    for (let i = 0; i < LOG_LIMIT; i++) appendLog({ ts: i, direction: 'widget→host', kind: 'request', payload: {} });
    const survivor = useStudioStore.getState().log[LOG_LIMIT - 1]!;
    for (let i = 0; i < 10; i++) appendLog({ ts: -1, direction: 'widget→host', kind: 'request', payload: {} });
    const log = useStudioStore.getState().log;
    expect(new Set(log.map((e) => e.seq)).size).toBe(LOG_LIMIT);
    expect(log.find((e) => e.ts === LOG_LIMIT - 1)?.seq).toBe(survivor.seq);
    expect(log.every((e, i) => i === 0 || e.seq > log[i - 1]!.seq)).toBe(true);
  });

  it('appends and clears log', () => {
    useStudioStore.getState().appendLog({ ts: 1, direction: 'widget→host', kind: 'request', payload: {} });
    expect(useStudioStore.getState().log).toHaveLength(1);
    useStudioStore.getState().clearLog();
    expect(useStudioStore.getState().log).toEqual([]);
  });

  it('replaceHostContext stores the given object as-is (identity is the no-echo signal for Canvas)', () => {
    const ctx = { ...defaultHostContext, displayMode: 'fullscreen' as const };
    useStudioStore.getState().replaceHostContext(ctx);
    expect(useStudioStore.getState().hostContext).toBe(ctx);
  });

  it('setDevice switches the preset and merges its context fields', () => {
    useStudioStore.getState().setDevice('mobile');
    const s = useStudioStore.getState();
    expect(s.device).toBe('mobile');
    expect(s.hostContext).toMatchObject({ platform: 'mobile', deviceCapabilities: { touch: true, hover: false } });
    expect(s.hostContext.theme).toBe('light');
  });

  it('addScenario adds a uniquely named recorded scenario to the active widget and selects it', () => {
    useStudioStore.getState().setWidgets(widgets);
    const first = useStudioStore.getState().addScenario({ mocks: {} });
    const second = useStudioStore.getState().addScenario({ mocks: { t: { kind: 'error', message: 'x' } } });
    expect([first, second]).toEqual(['recorded-1', 'recorded-2']);
    const s = useStudioStore.getState();
    expect(s.scenario).toBe('recorded-2');
    expect(Object.keys(s.widgets[0]?.scenarios ?? {})).toEqual(['default', 'error', 'recorded-1', 'recorded-2']);
    expect(s.widgets[1]?.scenarios).toEqual(widgets[1]?.scenarios);
  });

  it('replaceWidgets keeps the selection when it still exists and bumps the revision', () => {
    useStudioStore.getState().setWidgets(widgets);
    useStudioStore.getState().setActiveWidget('table');
    const before = useStudioStore.getState().revision;
    const edited = widgets.map((w) => (w.id === 'table' ? { ...w, title: 'Table v2' } : w));
    const errors = [{ file: '/p/broken.stories.mcp.ts', message: 'boom' }];
    useStudioStore.getState().replaceWidgets(edited, errors);
    const s = useStudioStore.getState();
    expect(s.activeWidgetId).toBe('table');
    expect(s.scenario).toBe('main');
    expect(s.widgets[1]?.title).toBe('Table v2');
    expect(s.errors).toEqual(errors);
    expect(s.revision).toBe(before + 1);
  });

  it('replaceWidgets falls back to the first widget and scenario when the selection vanished', () => {
    useStudioStore.getState().setWidgets(widgets);
    useStudioStore.getState().setScenario('error');
    useStudioStore.getState().replaceWidgets([{ ...widgets[0]!, scenarios: { default: { mocks: {} } } }], []);
    expect(useStudioStore.getState()).toMatchObject({ activeWidgetId: 'kpi', scenario: 'default' });
  });
});
