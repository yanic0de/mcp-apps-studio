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
