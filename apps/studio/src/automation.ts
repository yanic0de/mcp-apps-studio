import type { TraceEntry, useStudioStore } from './store.js';

/** What the canvas renders; `widget` is `null` until a manifest (or the demo) is loaded. */
export interface ActiveTarget {
  widget: string | null;
  scenario: string;
  theme: string;
}

/** Read-only automation hook, installed as `window.__mcpStudio` (used by `mcp-apps-studio test`). */
export interface AutomationHook {
  getLog(): TraceEntry[];
  getActive(): ActiveTarget;
}

/** Everything handed out is a copy: automation can observe the studio, never drive it. */
export function createAutomationHook(getState: typeof useStudioStore.getState): AutomationHook {
  return {
    getLog: () => structuredClone(getState().log),
    getActive: () => {
      const s = getState();
      return { widget: s.activeWidgetId, scenario: s.scenario, theme: s.hostContext.theme };
    },
  };
}
