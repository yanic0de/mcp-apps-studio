import type { App } from '@modelcontextprotocol/ext-apps';
import {
  initialToolLifecycle,
  reduceToolLifecycle,
  type ToolLifecycleEvent,
  type ToolLifecycleState,
} from './tool-lifecycle.js';

/** External store (useSyncExternalStore-shaped) over the tool call that rendered the widget. */
export interface ToolLifecycleStore<T = unknown> {
  getSnapshot(): ToolLifecycleState<T>;
  subscribe(listener: () => void): () => void;
}

/**
 * Subscribes to the app's lifecycle events at creation. Create it BEFORE `app.connect()`:
 * hosts play tool-input/tool-result right after `initialized`, possibly before any UI mounts.
 */
export function createToolLifecycleStore<T = unknown>(app: App): ToolLifecycleStore<T> {
  let state: ToolLifecycleState<T> = initialToolLifecycle;
  const listeners = new Set<() => void>();
  const dispatch = (ev: ToolLifecycleEvent) => {
    state = reduceToolLifecycle(state, ev);
    for (const l of [...listeners]) l();
  };
  app.addEventListener('toolinputpartial', (p) => dispatch({ type: 'input-partial', arguments: p.arguments ?? {} }));
  app.addEventListener('toolinput', (p) => dispatch({ type: 'input', arguments: p.arguments ?? {} }));
  app.addEventListener('toolresult', (result) => dispatch({ type: 'result', result }));
  app.addEventListener('toolcancelled', (p) => dispatch({ type: 'cancelled', reason: p.reason }));
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
