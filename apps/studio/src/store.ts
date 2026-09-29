import {
  type DiscoveryError,
  defaultHostContext,
  type HostContext,
  type RpcLogEvent,
  type Scenario,
  type WidgetManifestEntry,
} from '@studio/shared';
import { create } from 'zustand';
import { type Device, deviceContext } from './viewport.js';

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
  /** Stories that failed to load (CLI manifest). */
  errors: DiscoveryError[];
  /** Bumped when the manifest is reloaded; part of the iframe key, so the widget remounts. */
  revision: number;
  activeWidgetId: string | null;
  scenario: string;
  hostContext: HostContext;
  device: Device;
  /** Tool linked to the live widget (the "model's" call), for recording. */
  liveToolName: string | null;
  log: TraceEntry[];
  setWidgets: (widgets: WidgetManifestEntry[]) => void;
  /** Live reload: new manifest, same selection when it still exists. */
  replaceWidgets: (widgets: WidgetManifestEntry[], errors: DiscoveryError[]) => void;
  setActiveWidget: (id: string) => void;
  setScenario: (scenario: string) => void;
  setHostContext: (patch: Partial<HostContext>) => void;
  /** Adopts a context the emulator already applied (widget-initiated); kept by identity so Canvas does not echo it. */
  replaceHostContext: (context: HostContext) => void;
  setDevice: (device: Device) => void;
  setLiveToolName: (name: string | null) => void;
  /** Adds a session-only `recorded-<n>` scenario to the active widget, selects it, returns its name. */
  addScenario: (scenario: Scenario) => string;
  appendLog: (ev: RpcLogEvent) => void;
  clearLog: () => void;
}

export const useStudioStore = create<StudioState>()((set, get) => ({
  widgets: [],
  errors: [],
  revision: 0,
  activeWidgetId: null,
  scenario: 'default',
  hostContext: { ...defaultHostContext, ...deviceContext('desktop') },
  device: 'desktop',
  liveToolName: null,
  log: [],
  setWidgets: (widgets) =>
    set({ widgets, activeWidgetId: widgets[0]?.id ?? null, scenario: firstScenario(widgets[0]), log: [] }),
  replaceWidgets: (widgets, errors) =>
    set((s) => {
      const active = widgets.find((w) => w.id === s.activeWidgetId) ?? widgets[0];
      const scenario = active && s.scenario in active.scenarios ? s.scenario : firstScenario(active);
      // The widget remounts and handshakes again, so the trace starts over like on a scenario switch.
      return { widgets, errors, activeWidgetId: active?.id ?? null, scenario, revision: s.revision + 1, log: [] };
    }),
  setActiveWidget: (id) =>
    set((s) => {
      const widget = s.widgets.find((w) => w.id === id);
      return widget ? { activeWidgetId: id, scenario: firstScenario(widget), log: [] } : {};
    }),
  setScenario: (scenario) => set({ scenario, log: [] }),
  setHostContext: (patch) => set((s) => ({ hostContext: { ...s.hostContext, ...patch } })),
  replaceHostContext: (hostContext) => set({ hostContext }),
  addScenario: (scenario) => {
    const { widgets, activeWidgetId } = get();
    const active = widgets.find((w) => w.id === activeWidgetId);
    if (!active) throw new Error('no active widget to add a scenario to');
    let n = 1;
    while (`recorded-${n}` in active.scenarios) n++;
    const name = `recorded-${n}`;
    const entry = { mocks: scenario.mocks ?? {}, ...(scenario.toolCall ? { toolCall: scenario.toolCall } : {}) };
    set({
      widgets: widgets.map((w) => (w === active ? { ...w, scenarios: { ...w.scenarios, [name]: entry } } : w)),
      scenario: name,
      log: [],
    });
    return name;
  },
  setLiveToolName: (liveToolName) => set({ liveToolName }),
  setDevice: (device) => set((s) => ({ device, hostContext: { ...s.hostContext, ...deviceContext(device) } })),
  appendLog: (ev) => {
    const entry: TraceEntry = { ...ev, seq: ++nextSeq };
    set((s) => ({ log: [...s.log.slice(-(LOG_LIMIT - 1)), entry] }));
  },
  clearLog: () => set({ log: [] }),
}));

export function selectActiveWidget(s: StudioState): WidgetManifestEntry | undefined {
  return s.widgets.find((w) => w.id === s.activeWidgetId);
}
