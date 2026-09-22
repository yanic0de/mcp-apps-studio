import {
  type CallToolResult,
  callToolResultSchema,
  ERROR_CODES,
  type HostContext,
  JSON_RPC_VERSION,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  parseJsonRpcMessage,
  RequestTracker,
  RpcError,
} from '@studio/shared';

export interface WidgetWindow {
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  parent: { postMessage(message: unknown, targetOrigin: string): void };
}

export interface WidgetClientOptions {
  requestTimeoutMs?: number;
  /** Sent as `appInfo` in `ui/initialize`. */
  appInfo?: { name: string; version: string };
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Widget-side client for the MCP Apps host bridge. The ONLY sanctioned way for
 * widgets to talk to the host — components must never touch window.parent.
 * Failed calls reject with `RpcError` (code + message from the host).
 */
export class WidgetClient {
  private readonly tracker: RequestTracker;
  private readonly contextListeners = new Set<(patch: Partial<HostContext>) => void>();
  private readonly lifecycle = {
    inputPartial: new Set<(args: Record<string, unknown>) => void>(),
    input: new Set<(args: Record<string, unknown>) => void>(),
    result: new Set<(result: CallToolResult) => void>(),
    cancelled: new Set<(info: { reason?: string }) => void>(),
  };
  private readonly listener: (ev: MessageEvent) => void;
  private context: HostContext | null = null;
  private disposed = false;
  private readonly appInfo: { name: string; version: string };

  constructor(
    private readonly win: WidgetWindow = window as unknown as WidgetWindow,
    opts: WidgetClientOptions = {},
  ) {
    this.appInfo = opts.appInfo ?? { name: 'studio-widget', version: '0.0.0' };
    this.tracker = new RequestTracker({ idPrefix: 'w', timeoutMs: opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS });
    this.listener = (ev) => this.handleMessage(ev.data);
    win.addEventListener('message', this.listener);
  }

  async connect(): Promise<HostContext> {
    const result = (await this.request(MCP_APPS_METHODS.uiInitialize, {
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      appInfo: this.appInfo,
      appCapabilities: {},
    })) as { hostContext: HostContext };
    this.context = result.hostContext;
    this.post({ jsonrpc: JSON_RPC_VERSION, method: MCP_APPS_METHODS.initialized });
    return result.hostContext;
  }

  /** Resolves with the host's `CallToolResult`; tool failures arrive as `isError: true`, not rejections. */
  callTool(name: string, args?: unknown): Promise<CallToolResult> {
    return this.request(MCP_APPS_METHODS.toolsCall, { name, arguments: args ?? {} }) as Promise<CallToolResult>;
  }

  getHostContext(): HostContext | null {
    return this.context;
  }

  onHostContextChanged(cb: (patch: Partial<HostContext>) => void): () => void {
    this.contextListeners.add(cb);
    return () => this.contextListeners.delete(cb);
  }

  /** Streaming snapshots of the arguments of the tool call that rendered this widget. */
  onToolInputPartial(cb: (args: Record<string, unknown>) => void): () => void {
    return subscribe(this.lifecycle.inputPartial, cb);
  }

  /** Complete arguments of the tool call that rendered this widget (sent once, after initialized). */
  onToolInput(cb: (args: Record<string, unknown>) => void): () => void {
    return subscribe(this.lifecycle.input, cb);
  }

  /** Result of the tool call that rendered this widget. */
  onToolResult(cb: (result: CallToolResult) => void): () => void {
    return subscribe(this.lifecycle.result, cb);
  }

  onToolCancelled(cb: (info: { reason?: string }) => void): () => void {
    return subscribe(this.lifecycle.cancelled, cb);
  }

  sendSizeChanged(size: { width?: number; height?: number }): void {
    this.post({ jsonrpc: JSON_RPC_VERSION, method: MCP_APPS_METHODS.sizeChanged, params: size });
  }

  dispose(): void {
    this.disposed = true;
    this.win.removeEventListener('message', this.listener);
    this.tracker.rejectAll(new RpcError(ERROR_CODES.INTERNAL_ERROR, 'WidgetClient disposed'));
    this.contextListeners.clear();
    for (const set of Object.values(this.lifecycle)) set.clear();
  }

  /** Sandboxed widgets have a null origin, so the host can only be addressed with targetOrigin '*'. */
  private post(message: unknown): void {
    this.win.parent.postMessage(message, '*');
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new RpcError(ERROR_CODES.INTERNAL_ERROR, 'WidgetClient disposed'));
    }
    const { id, promise } = this.tracker.track(method);
    try {
      this.post({ jsonrpc: JSON_RPC_VERSION, id, method, ...(params !== undefined ? { params } : {}) });
    } catch (err) {
      this.tracker.reject(id, err); // e.g. DataCloneError for non-serializable args
    }
    return promise;
  }

  private handleMessage(raw: unknown): void {
    const parsed = parseJsonRpcMessage(raw);
    if (!parsed.ok) return;
    if (parsed.kind === 'response') {
      this.tracker.settle(parsed.message);
      return;
    }
    if (parsed.kind !== 'notification') return;
    const params = (parsed.message.params ?? {}) as Record<string, unknown>;
    switch (parsed.message.method) {
      case MCP_APPS_METHODS.hostContextChanged: {
        const patch = params as Partial<HostContext>;
        this.context = this.context ? { ...this.context, ...patch } : (patch as HostContext);
        for (const cb of [...this.contextListeners]) cb(patch);
        return;
      }
      case MCP_APPS_METHODS.toolInputPartial:
        emit(this.lifecycle.inputPartial, argumentsOf(params));
        return;
      case MCP_APPS_METHODS.toolInput:
        emit(this.lifecycle.input, argumentsOf(params));
        return;
      case MCP_APPS_METHODS.toolResult: {
        const result = callToolResultSchema.safeParse(params);
        if (result.success) emit(this.lifecycle.result, result.data);
        return;
      }
      case MCP_APPS_METHODS.toolCancelled:
        emit(this.lifecycle.cancelled, typeof params.reason === 'string' ? { reason: params.reason } : {});
        return;
    }
  }
}

function subscribe<T>(set: Set<(v: T) => void>, cb: (v: T) => void): () => void {
  set.add(cb);
  return () => set.delete(cb);
}

function emit<T>(set: Set<(v: T) => void>, value: T): void {
  for (const cb of [...set]) cb(value);
}

function argumentsOf(params: Record<string, unknown>): Record<string, unknown> {
  const args = params.arguments;
  return typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
}
