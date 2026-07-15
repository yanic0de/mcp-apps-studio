import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { HostContext } from '@studio/shared';
import type { WidgetClient } from './client.js';

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
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: false,
  });

  const call = useCallback(
    async (args?: unknown) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await client.callTool<T>(name, args);
        setState({ data, error: null, loading: false });
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
      }
    },
    [client, name],
  );

  return { ...state, call };
}
