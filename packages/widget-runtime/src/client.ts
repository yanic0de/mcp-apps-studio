import {
  ERROR_CODES,
  JSON_RPC_VERSION,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  RequestTracker,
  RpcError,
  parseJsonRpcMessage,
  type HostContext,
} from '@studio/shared';

export interface WidgetWindow {
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  parent: { postMessage(message: unknown, targetOrigin: string): void };
}

export interface WidgetClientOptions {
  requestTimeoutMs?: number;
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

  constructor(
    private readonly win: WidgetWindow = window as unknown as WidgetWindow,
    opts: WidgetClientOptions = {},
  ) {
    this.tracker = new RequestTracker({ idPrefix: 'w', timeoutMs: opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS });
    this.listener = (ev) => this.handleMessage(ev.data);
    win.addEventListener('message', this.listener);
  }

  async connect(): Promise<HostContext> {
    const result = (await this.request(MCP_APPS_METHODS.uiInitialize, {
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      appCapabilities: {},
    })) as { hostContext: HostContext };
    this.context = result.hostContext;
    return result.hostContext;
  }

  callTool<T = unknown>(name: string, args?: unknown): Promise<T> {
    return this.request(MCP_APPS_METHODS.toolsCall, { name, arguments: args ?? {} }) as Promise<T>;
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
