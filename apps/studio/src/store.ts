import { create } from 'zustand';
import { defaultHostContext, type HostContext, type RpcLogEvent, type WidgetManifestEntry } from '@studio/shared';

/** Chatty widgets must not grow the trace (and its re-renders) unbounded. */
export const LOG_LIMIT = 500;

function firstScenario(widget: WidgetManifestEntry | undefined): string {
  return Object.keys(widget?.scenarios ?? {})[0] ?? 'default';
}

interface StudioState {
  widgets: WidgetManifestEntry[];
  activeWidgetId: string | null;
  scenario: string;
  hostContext: HostContext;
  log: RpcLogEvent[];
  setWidgets: (widgets: WidgetManifestEntry[]) => void;
  setActiveWidget: (id: string) => void;
  setScenario: (scenario: string) => void;
  setHostContext: (patch: Partial<HostContext>) => void;
  appendLog: (ev: RpcLogEvent) => void;
  clearLog: () => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  widgets: [],
  activeWidgetId: null,
  scenario: 'default',
  hostContext: defaultHostContext,
  log: [],
  setWidgets: (widgets) =>
    set({ widgets, activeWidgetId: widgets[0]?.id ?? null, scenario: firstScenario(widgets[0]), log: [] }),
  setActiveWidget: (id) =>
    set((s) => {
      const widget = s.widgets.find((w) => w.id === id);
      return widget ? { activeWidgetId: id, scenario: firstScenario(widget), log: [] } : {};
    }),
  setScenario: (scenario) => set({ scenario, log: [] }),
  setHostContext: (patch) => set((s) => ({ hostContext: { ...s.hostContext, ...patch } })),
  appendLog: (ev) => set((s) => ({ log: [...s.log.slice(-(LOG_LIMIT - 1)), ev] })),
  clearLog: () => set({ log: [] }),
}));

export function selectActiveWidget(s: StudioState): WidgetManifestEntry | undefined {
  return s.widgets.find((w) => w.id === s.activeWidgetId);
}
