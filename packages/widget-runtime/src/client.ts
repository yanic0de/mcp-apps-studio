import {
  JSON_RPC_VERSION,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  parseJsonRpcMessage,
  type HostContext,
} from '@studio/shared';

export interface WidgetWindow {
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  parent: { postMessage(message: unknown, targetOrigin: string): void };
}

export class ToolCallError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'ToolCallError';
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface WidgetClientOptions {
  requestTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Widget-side client for the MCP Apps host bridge. The ONLY sanctioned way for
 * widgets to talk to the host — components must never touch window.parent.
 */
export class WidgetClient {
  private readonly pending = new Map<string, Pending>();
  private readonly contextListeners = new Set<(patch: Partial<HostContext>) => void>();
  private readonly listener: (ev: MessageEvent) => void;
  private counter = 0;
  private context: HostContext | null = null;
  private disposed = false;

  constructor(
    private readonly win: WidgetWindow = window as unknown as WidgetWindow,
    private readonly opts: WidgetClientOptions = {},
  ) {
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
    this.win.parent.postMessage(
      { jsonrpc: JSON_RPC_VERSION, method: MCP_APPS_METHODS.sizeChanged, params: size },
      '*',
    );
  }

  dispose(): void {
    this.disposed = true;
    this.win.removeEventListener('message', this.listener);
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('WidgetClient disposed'));
    }
    this.pending.clear();
    this.contextListeners.clear();
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error('WidgetClient disposed'));
    const id = `w${++this.counter}`;
    this.win.parent.postMessage(
      { jsonrpc: JSON_RPC_VERSION, id, method, ...(params !== undefined ? { params } : {}) },
      '*',
    );
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request "${method}" timed out`));
      }, this.opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
    });
  }

  private handleMessage(raw: unknown): void {
    const parsed = parseJsonRpcMessage(raw);
    if (!parsed.ok) return;
    if (parsed.kind === 'response') {
      const id = parsed.message.id;
      const pending = typeof id === 'string' ? this.pending.get(id) : undefined;
      if (!pending || typeof id !== 'string') return;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      if ('error' in parsed.message) {
        pending.reject(new ToolCallError(parsed.message.error.code, parsed.message.error.message));
      } else {
        pending.resolve(parsed.message.result);
      }
      return;
    }
    if (parsed.kind === 'notification' && parsed.message.method === MCP_APPS_METHODS.hostContextChanged) {
      const patch = (parsed.message.params ?? {}) as Partial<HostContext>;
      this.context = this.context ? { ...this.context, ...patch } : (patch as HostContext);
      for (const cb of [...this.contextListeners]) cb(patch);
    }
  }
}
