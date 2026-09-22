import { defaultHostContext, type HostContext, type RpcLogEvent, type WidgetManifestEntry } from '@studio/shared';
import { create } from 'zustand';

/** Chatty widgets must not grow the trace (and its re-renders) unbounded. */
export const LOG_LIMIT = 500;

/** A logged event plus a monotonic seq: the React key that stays stable while the capped log slides. */
export interface TraceEntry extends RpcLogEvent {
  seq: number;
}

let nextSeq = 0;

function firstScenario(widget: WidgetManifestEntry | undefined): string {
  return Object.keys(widget?.scenarios ?? {})[0] ?? 'default';
}

interface StudioState {
  widgets: WidgetManifestEntry[];
  activeWidgetId: string | null;
  scenario: string;
  hostContext: HostContext;
  log: TraceEntry[];
  setWidgets: (widgets: WidgetManifestEntry[]) => void;
  setActiveWidget: (id: string) => void;
  setScenario: (scenario: string) => void;
  setHostContext: (patch: Partial<HostContext>) => void;
  /** Adopts a context the emulator already applied (widget-initiated); kept by identity so Canvas does not echo it. */
  replaceHostContext: (context: HostContext) => void;
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
  replaceHostContext: (hostContext) => set({ hostContext }),
  appendLog: (ev) => {
    const entry: TraceEntry = { ...ev, seq: ++nextSeq };
    set((s) => ({ log: [...s.log.slice(-(LOG_LIMIT - 1)), entry] }));
  },
  clearLog: () => set({ log: [] }),
}));

export function selectActiveWidget(s: StudioState): WidgetManifestEntry | undefined {
  return s.widgets.find((w) => w.id === s.activeWidgetId);
}
