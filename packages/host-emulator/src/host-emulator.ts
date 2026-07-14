import {
  ERROR_CODES,
  defaultHostContext,
  type HostContext,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type MockConfig,
  type RpcLogEvent,
} from '@studio/shared';
import type { HostAdapter } from './adapter.js';
import { RpcError } from './errors.js';
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
}

export class HostEmulator {
  private readonly bridge: MessageBridge;
  private readonly mockRouter: MockRouter;
  private context: HostContext;

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
    this.bridge.start();
  }

  stop(): void {
    this.bridge.stop();
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
        return this.opts.adapter.buildInitializeResult(this.context);
      case 'tool-call':
        return this.mockRouter.call(action.toolName, action.args);
      case 'resource-read': {
        const text = this.opts.resources?.[action.uri];
        if (text === undefined) {
          throw new RpcError(ERROR_CODES.RESOURCE_NOT_FOUND, `Unknown resource: ${action.uri}`);
        }
        return { contents: [{ uri: action.uri, mimeType: 'text/html', text }] };
      }
      case 'invalid-params':
        throw new RpcError(ERROR_CODES.INVALID_PARAMS, action.error);
      case 'unsupported':
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unsupported method: ${action.method}`);
      default:
        throw new RpcError(ERROR_CODES.INTERNAL_ERROR, `Request produced non-request action: ${(action as { type: string }).type}`);
    }
  }

  private handleNotification(n: JsonRpcNotification): void {
    const action = this.opts.adapter.handleWidgetMessage(n);
    if (action.type === 'size-changed') {
      this.opts.onSizeChanged?.({ width: action.width, height: action.height });
    }
  }
}
