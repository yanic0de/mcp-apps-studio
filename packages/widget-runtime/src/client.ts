import {
  type CallToolResult,
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

  sendSizeChanged(size: { width?: number; height?: number }): void {
    this.post({ jsonrpc: JSON_RPC_VERSION, method: MCP_APPS_METHODS.sizeChanged, params: size });
  }

  dispose(): void {
    this.disposed = true;
    this.win.removeEventListener('message', this.listener);
    this.tracker.rejectAll(new RpcError(ERROR_CODES.INTERNAL_ERROR, 'WidgetClient disposed'));
    this.contextListeners.clear();
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
    if (parsed.kind === 'notification' && parsed.message.method === MCP_APPS_METHODS.hostContextChanged) {
      const patch = (parsed.message.params ?? {}) as Partial<HostContext>;
      this.context = this.context ? { ...this.context, ...patch } : (patch as HostContext);
      for (const cb of [...this.contextListeners]) cb(patch);
    }
  }
}
