import type { HostContext } from '@studio/shared';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type { WidgetClient } from './client.js';
import { createToolCaller, type ToolCallSnapshot } from './tool-caller.js';
import {
  initialToolLifecycle,
  reduceToolLifecycle,
  type ToolLifecycleEvent,
  type ToolLifecycleState,
} from './tool-lifecycle.js';
import { toolResultData } from './tool-result.js';

const WidgetClientContext = createContext<WidgetClient | null>(null);

export function WidgetProvider({ client, children }: { client: WidgetClient; children: ReactNode }) {
  return <WidgetClientContext.Provider value={client}>{children}</WidgetClientContext.Provider>;
}

export function useWidgetClient(): WidgetClient {
  const client = useContext(WidgetClientContext);
  if (!client) throw new Error('useWidgetClient must be used inside <WidgetProvider>');
  return client;
}

export function useHostContext(): HostContext | null {
  const client = useWidgetClient();
  const [ctx, setCtx] = useState(client.getHostContext());
  useEffect(() => client.onHostContextChanged(() => setCtx(client.getHostContext())), [client]);
  return ctx;
}

export interface ToolCallState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  call: (args?: unknown) => Promise<void>;
}

export function useToolCall<T = unknown>(name: string): ToolCallState<T> {
  const client = useWidgetClient();
  const [state, setState] = useState<ToolCallSnapshot<T | null>>({
    data: null,
    error: null,
    loading: false,
  });

  // data = structuredContent; an isError result becomes `error` like a rejected call.
  const call = useMemo(
    () => createToolCaller<T | null>(async (args) => toolResultData<T>(await client.callTool(name, args)), setState),
    [client, name],
  );

  return { ...state, call };
}

/** State of the tool call that rendered this widget, driven by the host's lifecycle notifications. */
export function useToolLifecycle<T = unknown>(): ToolLifecycleState<T> {
  const client = useWidgetClient();
  const [state, dispatch] = useReducer(
    (s: ToolLifecycleState<T>, ev: ToolLifecycleEvent) => reduceToolLifecycle(s, ev),
    initialToolLifecycle,
  );
  useEffect(() => {
    const offs = [
      client.onToolInputPartial((args) => dispatch({ type: 'input-partial', arguments: args })),
      client.onToolInput((args) => dispatch({ type: 'input', arguments: args })),
      client.onToolResult((result) => dispatch({ type: 'result', result })),
      client.onToolCancelled(({ reason }) => dispatch({ type: 'cancelled', reason })),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [client]);
  return state;
}
