export interface Transport {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
}

type Handler = (message: unknown) => void;

export function createInMemoryTransportPair(): [Transport, Transport] {
  const a = new Set<Handler>();
  const b = new Set<Handler>();
  const make = (own: Set<Handler>, peer: Set<Handler>): Transport => ({
    send(message) {
      queueMicrotask(() => {
        for (const h of peer) h(message);
      });
    },
    onMessage(handler) {
      own.add(handler);
      return () => own.delete(handler);
    },
  });
  return [make(a, b), make(b, a)];
}

/**
 * Structural twin of the MCP SDK `Transport` (start/send/close + onmessage), so the official
 * ext-apps `App` can talk to the emulator over an in-memory end without this package importing the SDK.
 */
export interface McpTransportLike {
  start(): Promise<void>;
  send(message: unknown): Promise<void>;
  close(): Promise<void>;
  // biome-ignore lint/suspicious/noExplicitAny: must accept the SDK's generic JSONRPCMessage handler
  onmessage?: (message: any, extra?: any) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
}

export function toMcpTransport(end: Transport): McpTransportLike {
  let off: (() => void) | undefined;
  const t: McpTransportLike = {
    async start() {
      off = end.onMessage((m) => t.onmessage?.(m));
    },
    async send(message) {
      end.send(message);
    },
    async close() {
      off?.();
      t.onclose?.();
    },
  };
  return t;
}
