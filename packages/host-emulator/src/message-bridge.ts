import {
  ERROR_CODES,
  JSON_RPC_VERSION,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  parseJsonRpcMessage,
  RequestTracker,
  RpcError,
  type RpcLogEvent,
} from '@studio/shared';
import type { Transport } from './transport.js';

export interface MessageBridgeOptions {
  transport: Transport;
  /** Handles widget-originated requests; return value becomes the JSON-RPC result. Throw RpcError for protocol errors. */
  onRequest: (req: JsonRpcRequest) => Promise<unknown>;
  onNotification?: (n: JsonRpcNotification) => void;
  onLog?: (ev: RpcLogEvent) => void;
  requestTimeoutMs?: number;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class MessageBridge {
  private readonly tracker: RequestTracker;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly opts: MessageBridgeOptions) {
    this.tracker = new RequestTracker({ idPrefix: 'h', timeoutMs: opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS });
  }

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.opts.transport.onMessage((raw) => void this.handleIncoming(raw));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.tracker.rejectAll(new RpcError(ERROR_CODES.INTERNAL_ERROR, 'bridge stopped'));
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const { id, promise } = this.tracker.track(method);
    const msg = { jsonrpc: JSON_RPC_VERSION, id, method, ...(params !== undefined ? { params } : {}) };
    this.log({ direction: 'host→widget', kind: 'request', method, id, payload: msg });
    try {
      this.opts.transport.send(msg);
    } catch (err) {
      this.tracker.reject(id, err);
    }
    return promise;
  }

  notify(method: string, params?: unknown): void {
    const msg = { jsonrpc: JSON_RPC_VERSION, method, ...(params !== undefined ? { params } : {}) };
    this.log({ direction: 'host→widget', kind: 'notification', method, payload: msg });
    this.opts.transport.send(msg);
  }

  private log(ev: Omit<RpcLogEvent, 'ts'>): void {
    this.opts.onLog?.({ ts: (this.opts.now ?? Date.now)(), ...ev });
  }

  private async handleIncoming(raw: unknown): Promise<void> {
    const parsed = parseJsonRpcMessage(raw);
    if (!parsed.ok) {
      this.log({ direction: 'widget→host', kind: 'invalid', payload: raw, error: parsed.error });
      return;
    }
    switch (parsed.kind) {
      case 'request':
        return this.handleRequest(parsed.message);
      case 'notification':
        this.log({
          direction: 'widget→host',
          kind: 'notification',
          method: parsed.message.method,
          payload: parsed.message,
        });
        this.opts.onNotification?.(parsed.message);
        return;
      case 'response':
        return this.handleResponse(parsed.message);
    }
  }

  private async handleRequest(req: JsonRpcRequest): Promise<void> {
    this.log({ direction: 'widget→host', kind: 'request', method: req.method, id: req.id, payload: req });
    let response: Record<string, unknown>;
    try {
      const result = await this.opts.onRequest(req);
      response = { jsonrpc: JSON_RPC_VERSION, id: req.id, result };
    } catch (err) {
      const rpcErr =
        err instanceof RpcError
          ? err
          : new RpcError(ERROR_CODES.INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
      response = {
        jsonrpc: JSON_RPC_VERSION,
        id: req.id,
        error: {
          code: rpcErr.code,
          message: rpcErr.message,
          ...(rpcErr.data !== undefined ? { data: rpcErr.data } : {}),
        },
      };
    }
    if (!this.unsubscribe) return; // stopped while handling
    this.log({ direction: 'host→widget', kind: 'response', id: req.id, payload: response });
    this.opts.transport.send(response);
  }

  private handleResponse(msg: JsonRpcResponse): void {
    if (!this.tracker.settle(msg)) {
      this.log({
        direction: 'widget→host',
        kind: 'invalid',
        payload: msg,
        error: `unexpected response id: ${String(msg.id)}`,
      });
      return;
    }
    this.log({ direction: 'widget→host', kind: 'response', id: msg.id ?? undefined, payload: msg });
  }
}
