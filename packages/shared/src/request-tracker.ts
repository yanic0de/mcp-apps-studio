import { RpcError } from './errors.js';
import { ERROR_CODES, type JsonRpcId, type JsonRpcResponse } from './json-rpc.js';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RequestTrackerOptions {
  /** Prefix for generated ids, so host- and widget-originated ids never collide (`h1` vs `w1`). */
  idPrefix: string;
  timeoutMs: number;
}

/**
 * Correlates outgoing JSON-RPC requests with their responses: id allocation,
 * per-request timeout, settlement from a wire response, bulk rejection on shutdown.
 * Shared by the host bridge and the widget client — they differ only in transport.
 */
export class RequestTracker {
  private readonly pending = new Map<JsonRpcId, Pending>();
  private counter = 0;

  constructor(private readonly opts: RequestTrackerOptions) {}

  get size(): number {
    return this.pending.size;
  }

  /** Allocates an id and a promise that settles via `settle`/`reject`, or rejects on timeout. */
  track(method: string): { id: string; promise: Promise<unknown> } {
    const id = `${this.opts.idPrefix}${++this.counter}`;
    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcError(ERROR_CODES.REQUEST_TIMEOUT, `Request "${method}" timed out`));
      }, this.opts.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    return { id, promise };
  }

  /** Settles the tracked request a wire response belongs to. Returns false for unknown (or null) ids. */
  settle(response: JsonRpcResponse): boolean {
    const pending = this.take(response.id);
    if (!pending) return false;
    if ('error' in response) {
      pending.reject(new RpcError(response.error.code, response.error.message, response.error.data));
    } else {
      pending.resolve(response.result);
    }
    return true;
  }

  /** Rejects one tracked request locally (e.g. the transport threw while sending). */
  reject(id: JsonRpcId, error: unknown): boolean {
    const pending = this.take(id);
    if (!pending) return false;
    pending.reject(error);
    return true;
  }

  rejectAll(error: unknown): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }

  private take(id: JsonRpcId | null): Pending | undefined {
    if (id === null) return undefined;
    const pending = this.pending.get(id);
    if (!pending) return undefined;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    return pending;
  }
}
