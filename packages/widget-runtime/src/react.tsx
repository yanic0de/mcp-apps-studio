import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HostContext } from '@studio/shared';
import type { WidgetClient } from './client.js';
import { createToolCaller, type ToolCallSnapshot } from './tool-caller.js';

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
  const [state, setState] = useState<ToolCallSnapshot<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const call = useMemo(
    () => createToolCaller<T>((args) => client.callTool<T>(name, args), setState),
    [client, name],
  );

  return { ...state, call };
}
