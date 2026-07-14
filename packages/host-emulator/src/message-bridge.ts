import {
  ERROR_CODES,
  JSON_RPC_VERSION,
  parseJsonRpcMessage,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type RpcLogEvent,
} from '@studio/shared';
import { RpcError } from './errors.js';
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

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class MessageBridge {
  private readonly pending = new Map<JsonRpcId, Pending>();
  private unsubscribe: (() => void) | null = null;
  private counter = 0;

  constructor(private readonly opts: MessageBridgeOptions) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.opts.transport.onMessage((raw) => void this.handleIncoming(raw));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new RpcError(ERROR_CODES.INTERNAL_ERROR, 'bridge stopped'));
    }
    this.pending.clear();
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = `h${++this.counter}`;
    const msg = { jsonrpc: JSON_RPC_VERSION, id, method, ...(params !== undefined ? { params } : {}) };
    this.log({ direction: 'host→widget', kind: 'request', method, id, payload: msg });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError(ERROR_CODES.REQUEST_TIMEOUT, `Request "${method}" timed out`));
      }, this.opts.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.opts.transport.send(msg);
    });
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
        this.log({ direction: 'widget→host', kind: 'notification', method: parsed.message.method, payload: parsed.message });
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
        err instanceof RpcError ? err : new RpcError(ERROR_CODES.INTERNAL_ERROR, err instanceof Error ? err.message : String(err));
      response = {
        jsonrpc: JSON_RPC_VERSION,
        id: req.id,
        error: { code: rpcErr.code, message: rpcErr.message, ...(rpcErr.data !== undefined ? { data: rpcErr.data } : {}) },
      };
    }
    if (!this.unsubscribe) return; // stopped while handling
    this.log({ direction: 'host→widget', kind: 'response', id: req.id, payload: response });
    this.opts.transport.send(response);
  }

  private handleResponse(msg: JsonRpcResponse): void {
    const id = msg.id;
    const pending = id === null ? undefined : this.pending.get(id);
    if (!pending || id === null) {
      this.log({ direction: 'widget→host', kind: 'invalid', payload: msg, error: `unexpected response id: ${String(id)}` });
      return;
    }
    this.pending.delete(id);
    clearTimeout(pending.timer);
    this.log({ direction: 'widget→host', kind: 'response', id, payload: msg });
    if ('error' in msg) {
      pending.reject(new RpcError(msg.error.code, msg.error.message, msg.error.data));
    } else {
      pending.resolve(msg.result);
    }
  }
}
