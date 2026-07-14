import { create } from 'zustand';
import { defaultHostContext, type HostContext, type MockConfig, type RpcLogEvent } from '@studio/shared';

export type ScenarioId = 'default' | 'loading' | 'error';

export const scenarios: Record<ScenarioId, MockConfig> = {
  default: {
    get_metrics: {
      kind: 'static',
      result: { value: 12840, delta: 8.3, label: 'Monthly active users' },
    },
  },
  loading: {
    get_metrics: {
      kind: 'static',
      result: { value: 12840, delta: 8.3, label: 'Monthly active users' },
      delayMs: 3_600_000,
    },
  },
  error: {
    get_metrics: {
      kind: 'error',
      error: { code: -32000, message: 'Metrics backend unavailable' },
    },
  },
};

interface StudioState {
  hostContext: HostContext;
  scenario: ScenarioId;
  log: RpcLogEvent[];
  setHostContext: (patch: Partial<HostContext>) => void;
  setScenario: (scenario: ScenarioId) => void;
  appendLog: (ev: RpcLogEvent) => void;
  clearLog: () => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  hostContext: defaultHostContext,
  scenario: 'default',
  log: [],
  setHostContext: (patch) => set((s) => ({ hostContext: { ...s.hostContext, ...patch } })),
  setScenario: (scenario) => set({ scenario, log: [] }),
  appendLog: (ev) => set((s) => ({ log: [...s.log, ev] })),
  clearLog: () => set({ log: [] }),
}));
