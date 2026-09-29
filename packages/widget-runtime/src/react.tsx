import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { WidgetSession } from './session.js';
import { createToolCaller, type ToolCallSnapshot } from './tool-caller.js';
import type { ToolLifecycleState } from './tool-lifecycle.js';
import { toolResultData } from './tool-result.js';

const SessionContext = createContext<WidgetSession | null>(null);

/** Provides the `connectWidget` session (the SDK `App` + the recorded tool lifecycle). */
export function WidgetProvider({ session, children }: { session: WidgetSession; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

function useSession(): WidgetSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('widget hooks must be used inside <WidgetProvider>');
  return session;
}

/** The official ext-apps `App`: openLink, sendMessage, requestDisplayMode, updateModelContext, … */
export function useWidgetApp(): App {
  return useSession().app;
}

export function useHostContext(): McpUiHostContext | undefined {
  const app = useWidgetApp();
  const [ctx, setCtx] = useState(() => app.getHostContext());
  useEffect(() => {
    const onChange = () => setCtx({ ...app.getHostContext() });
    app.addEventListener('hostcontextchanged', onChange);
    return () => app.removeEventListener('hostcontextchanged', onChange);
  }, [app]);
  return ctx;
}

export interface ToolCallState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  call: (args?: Record<string, unknown>) => Promise<void>;
}

/** The widget's own tool call: data = structuredContent, isError text or rejection → error, latest call wins. */
export function useToolCall<T = unknown>(name: string): ToolCallState<T> {
  const app = useWidgetApp();
  const [state, setState] = useState<ToolCallSnapshot<T | null>>({ data: null, error: null, loading: false });
  const call = useMemo(
    () =>
      createToolCaller<T | null>(
        async (args) =>
          toolResultData<T>(await app.callServerTool({ name, arguments: (args ?? {}) as Record<string, unknown> })),
        setState,
      ),
    [app, name],
  );
  return { ...state, call };
}

/** State of the tool call that rendered this widget (recorded since before the handshake). */
export function useToolLifecycle<T = unknown>(): ToolLifecycleState<T> {
  const { lifecycle } = useSession();
  return useSyncExternalStore(
    lifecycle.subscribe,
    lifecycle.getSnapshot,
    lifecycle.getSnapshot,
  ) as ToolLifecycleState<T>;
}
