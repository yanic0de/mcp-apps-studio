import {
  type CallToolResult,
  defaultHostContext,
  ERROR_CODES,
  type HostContext,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type MockConfig,
  RpcError,
  type RpcLogEvent,
  type ToolCall,
} from '@studio/shared';
import type { HostAdapter, HostEvent, WidgetIntent } from './adapter.js';

import { MessageBridge } from './message-bridge.js';
import { MockRouter, type PassthroughHandler } from './mock-router.js';
import type { Transport } from './transport.js';

export interface HostEmulatorOptions {
  adapter: HostAdapter;
  transport: Transport;
  mocks?: MockConfig;
  passthrough?: PassthroughHandler;
  /** uri → text content served for resources/read */
  resources?: Record<string, string>;
  hostContext?: HostContext;
  onLog?: (ev: RpcLogEvent) => void;
  onSizeChanged?: (size: { width?: number; height?: number }) => void;
  /** Links, messages, model context, downloads, logs, teardown requests — the host "UI side" of the widget. */
  onWidgetIntent?: (intent: WidgetIntent) => void;
  /** Context changes the WIDGET initiated (e.g. an accepted display-mode request); the full new context. */
  onHostContextChanged?: (context: HostContext) => void;
  /** The tool call that rendered the widget, played after `initialized`. */
  toolCall?: ToolCall;
  /** Definition of that tool (e.g. from tools/list) for `hostContext.toolInfo`. */
  toolDefinition?: { name: string; [key: string]: unknown };
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class HostEmulator {
  private readonly bridge: MessageBridge;
  private readonly mockRouter: MockRouter;
  private context: HostContext;
  private ready = false;
  private running = false;

  constructor(private readonly opts: HostEmulatorOptions) {
    this.context = opts.hostContext ?? defaultHostContext;
    this.mockRouter = new MockRouter(opts.mocks ?? {}, opts.passthrough);
    this.bridge = new MessageBridge({
      transport: opts.transport,
      onRequest: (req) => this.handleRequest(req),
      onNotification: (n) => this.handleNotification(n),
      onLog: opts.onLog,
    });
  }

  start(): void {
    this.running = true;
    this.bridge.start();
  }

  stop(): void {
    this.running = false;
    this.bridge.stop();
  }

  /** True once the widget sent `ui/notifications/initialized` after the handshake. */
  isReady(): boolean {
    return this.ready;
  }

  getHostContext(): HostContext {
    return this.context;
  }

  setHostContext(patch: Partial<HostContext>): void {
    this.context = { ...this.context, ...patch };
    const wire = this.opts.adapter.pushHostEvent({ type: 'context-changed', context: patch });
    if (wire) this.bridge.notify(wire.method, wire.params);
  }

  setMocks(config: MockConfig): void {
    this.mockRouter.setConfig(config);
  }

  private async handleRequest(req: JsonRpcRequest): Promise<unknown> {
    const action = this.opts.adapter.handleWidgetMessage(req);
    switch (action.type) {
      case 'initialize':
        // A new handshake is a new view instance (e.g. the frame reloaded): it gets the lifecycle again.
        this.ready = false;
        // toolInfo belongs to this widget instance only, so it never enters the shared context.
        return this.opts.adapter.buildInitializeResult({ ...this.context, ...this.toolInfo() });
      case 'tool-call':
        return this.mockRouter.call(action.toolName, action.args);
      case 'resource-read': {
        const text = this.opts.resources?.[action.uri];
        if (text === undefined) {
          throw new RpcError(ERROR_CODES.RESOURCE_NOT_FOUND, `Unknown resource: ${action.uri}`);
        }
        return { contents: [{ uri: action.uri, mimeType: 'text/html', text }] };
      }
      case 'request-display-mode':
        return { mode: this.requestDisplayMode(action.mode) };
      // A fake host has nothing to open or send: report to the embedder and answer as a permissive host would.
      case 'open-link':
      case 'message':
      case 'update-model-context':
      case 'download-file':
        this.opts.onWidgetIntent?.(action);
        return {};
      case 'invalid-params':
        throw new RpcError(ERROR_CODES.INVALID_PARAMS, action.error);
      case 'unsupported':
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unsupported method: ${action.method}`);
      default:
        throw new RpcError(
          ERROR_CODES.INTERNAL_ERROR,
          `Request produced non-request action: ${(action as { type: string }).type}`,
        );
    }
  }

  private handleNotification(n: JsonRpcNotification): void {
    const action = this.opts.adapter.handleWidgetMessage(n);
    switch (action.type) {
      case 'size-changed':
        this.opts.onSizeChanged?.({ width: action.width, height: action.height });
        return;
      case 'initialized':
        if (this.ready) return; // tool-input is sent exactly once
        this.ready = true;
        void this.playToolCall();
        return;
      case 'log':
      case 'request-teardown':
        this.opts.onWidgetIntent?.(action);
        return;
      // Notifications have no response channel, so problems must surface in the trace.
      case 'invalid-params':
        this.logInvalidNotification(n, `Invalid params: ${action.error}`);
        return;
      case 'unsupported':
        this.logInvalidNotification(n, `Unsupported notification: ${n.method}`);
        return;
      default:
        return;
    }
  }

  private push(ev: HostEvent): void {
    if (!this.running) return;
    const wire = this.opts.adapter.pushHostEvent(ev);
    if (wire) this.bridge.notify(wire.method, wire.params);
  }

  private toolInfo(): { toolInfo?: { tool: Record<string, unknown> } } {
    const name = this.opts.toolCall?.name;
    if (!name) return {};
    const tool = this.opts.toolDefinition ?? { name, inputSchema: { type: 'object' } };
    return { toolInfo: { tool } };
  }

  /** Host side of the model's tool call: partial inputs → input → result | cancelled (SEP-1865 ordering). */
  private async playToolCall(): Promise<void> {
    const call = this.opts.toolCall;
    if (!call) return;
    for (const partial of call.partialInputs ?? []) this.push({ type: 'tool-input-partial', arguments: partial });
    const input = call.input ?? {};
    this.push({ type: 'tool-input', arguments: input });
    const result = call.result;
    if (!result) return;
    if (result.kind === 'cancelled') {
      if (result.delayMs) await delay(result.delayMs);
      this.push({ type: 'tool-cancelled', reason: result.reason });
      return;
    }
    const name = call.name ?? 'tool';
    try {
      // One-entry router: same CallToolResult shaping, delay and passthrough as tools/call.
      const value = await new MockRouter({ [name]: result }, this.opts.passthrough).call(name, input);
      this.push({ type: 'tool-result', result: value as CallToolResult });
    } catch (err) {
      this.push({ type: 'tool-cancelled', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Applies a widget-requested mode if the host offers it; returns the mode actually in effect. */
  private requestDisplayMode(mode: HostContext['displayMode']): HostContext['displayMode'] {
    if (mode !== this.context.displayMode && this.opts.adapter.capabilities().displayModes.includes(mode)) {
      this.setHostContext({ displayMode: mode });
      this.opts.onHostContextChanged?.(this.context);
    }
    return this.context.displayMode;
  }

  private logInvalidNotification(n: JsonRpcNotification, error: string): void {
    this.opts.onLog?.({
      ts: Date.now(),
      direction: 'widget→host',
      kind: 'invalid',
      method: n.method,
      payload: n,
      error,
    });
  }
}
