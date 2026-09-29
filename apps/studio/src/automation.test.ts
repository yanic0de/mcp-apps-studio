import type { WidgetManifestEntry } from '@studio/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAutomationHook } from './automation.js';
import { applyDeepLink } from './deep-link.js';
import { useStudioStore } from './store.js';

const initial = useStudioStore.getState();
const widgets: WidgetManifestEntry[] = [
  { id: 'kpi', title: 'KPI', html: '', scenarios: { default: { mocks: {} } } },
  { id: 'table', title: 'Table', html: '', scenarios: { main: { mocks: {} }, empty: { mocks: {} } } },
];

beforeEach(() => {
  useStudioStore.setState(initial, true);
});

describe('createAutomationHook', () => {
  const hook = createAutomationHook(useStudioStore.getState);

  it('reports the rendered widget, scenario and theme', () => {
    useStudioStore.getState().setWidgets(widgets);
    applyDeepLink('?widget=table&scenario=empty&theme=dark');
    expect(hook.getActive()).toEqual({ widget: 'table', scenario: 'empty', theme: 'dark' });
  });

  it('does not report an unknown deep-linked widget as rendered', () => {
    useStudioStore.getState().setWidgets(widgets);
    applyDeepLink('?widget=ghost');
    expect(hook.getActive().widget).not.toBe('ghost');
  });

  it('reports no widget before the manifest loaded', () => {
    expect(hook.getActive().widget).toBeNull();
  });

  it('returns a copy of the log that cannot change the store', () => {
    useStudioStore
      .getState()
      .appendLog({ ts: 1, direction: 'widget→host', kind: 'notification', method: 'x', payload: {} });
    const log = hook.getLog();
    log.length = 0;
    expect(useStudioStore.getState().log).toHaveLength(1);
  });
});
