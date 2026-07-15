import { beforeEach, describe, expect, it } from 'vitest';
import { defaultHostContext, type WidgetManifestEntry } from '@studio/shared';
import { useStudioStore } from './store.js';

const initial = useStudioStore.getState();

beforeEach(() => useStudioStore.setState(initial, true));

const widgets: WidgetManifestEntry[] = [
  {
    id: 'kpi',
    title: 'KPI Card',
    html: '<html>kpi</html>',
    scenarios: { default: { mocks: {} }, error: { mocks: { t: { kind: 'error', error: { code: -1, message: 'x' } } } } },
  },
  {
    id: 'table',
    title: 'Data Table',
    html: '<html>table</html>',
    scenarios: { main: { mocks: {} } },
  },
];

describe('studio store', () => {
  it('starts with default context, no widgets, empty log', () => {
    const s = useStudioStore.getState();
    expect(s.hostContext).toEqual(defaultHostContext);
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

  it('appends and clears log', () => {
    useStudioStore.getState().appendLog({ ts: 1, direction: 'widget→host', kind: 'request', payload: {} });
    expect(useStudioStore.getState().log).toHaveLength(1);
    useStudioStore.getState().clearLog();
    expect(useStudioStore.getState().log).toEqual([]);
  });
});
