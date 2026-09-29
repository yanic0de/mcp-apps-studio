import type { WidgetManifestEntry } from '@studio/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyDeepLink } from './deep-link.js';
import { useStudioStore } from './store.js';

const initial = useStudioStore.getState();
const widgets: WidgetManifestEntry[] = [
  { id: 'kpi', title: 'KPI', html: '', scenarios: { default: { mocks: {} }, error: { mocks: {} } } },
  { id: 'table', title: 'Table', html: '', scenarios: { main: { mocks: {} }, empty: { mocks: {} } } },
];

beforeEach(() => {
  useStudioStore.setState(initial, true);
  useStudioStore.getState().setWidgets(widgets);
});

describe('applyDeepLink', () => {
  it('selects widget, scenario, theme, display and device', () => {
    applyDeepLink('?widget=table&scenario=empty&theme=dark&display=fullscreen&device=mobile');
    const s = useStudioStore.getState();
    expect(s.activeWidgetId).toBe('table');
    expect(s.scenario).toBe('empty');
    expect(s.hostContext).toMatchObject({ theme: 'dark', displayMode: 'fullscreen', platform: 'mobile' });
    expect(s.device).toBe('mobile');
  });

  it('applies the scenario to the default widget when no widget is given', () => {
    applyDeepLink('?scenario=error');
    expect(useStudioStore.getState()).toMatchObject({ activeWidgetId: 'kpi', scenario: 'error' });
  });

  it('ignores unknown or invalid values', () => {
    applyDeepLink('?widget=ghost&scenario=nope&theme=sepia&display=sidebar&device=watch');
    const s = useStudioStore.getState();
    expect(s.activeWidgetId).toBe('kpi');
    expect(s.scenario).toBe('default');
    expect(s.hostContext).toMatchObject({ theme: 'light', displayMode: 'inline' });
    expect(s.device).toBe('desktop');
  });
});
