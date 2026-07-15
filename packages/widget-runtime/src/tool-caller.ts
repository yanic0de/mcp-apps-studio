export interface ToolCallSnapshot<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Wraps a tool-call function with latest-call-wins semantics: when calls
 * overlap, a stale settlement must not overwrite the newer one's state.
 */
export function createToolCaller<T>(
  callTool: (args?: unknown) => Promise<T>,
  setState: (updater: (prev: ToolCallSnapshot<T>) => ToolCallSnapshot<T>) => void,
): (args?: unknown) => Promise<void> {
  let seq = 0;
  return async (args?: unknown) => {
    const id = ++seq;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await callTool(args);
      if (id !== seq) return;
      setState(() => ({ data, error: null, loading: false }));
    } catch (e) {
      if (id !== seq) return;
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }));
    }
  };
}
