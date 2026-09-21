import { describe, expect, it, vi } from 'vitest';
import { ERROR_CODES, RpcError, type RpcLogEvent } from '@studio/shared';
import { MessageBridge } from './message-bridge.js';
import { createInMemoryTransportPair, type Transport } from './transport.js';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function widgetSide(t: Transport) {
  const received: unknown[] = [];
  t.onMessage((m) => received.push(m));
  return { received, send: (m: unknown) => t.send(m) };
}

describe('MessageBridge', () => {
  it('dispatches incoming widget request to onRequest and responds with result', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async (req) => ({ echoed: req.method }),
    });
    bridge.start();
    widget.send({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 't' } });
    await flush();
    expect(widget.received).toEqual([{ jsonrpc: '2.0', id: 7, result: { echoed: 'tools/call' } }]);
  });

  it('maps RpcError thrown by onRequest to a JSON-RPC error response', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async () => {
        throw new RpcError(ERROR_CODES.METHOD_NOT_FOUND, 'no such method');
      },
    });
    bridge.start();
    widget.send({ jsonrpc: '2.0', id: 1, method: 'nope' });
    await flush();
    expect(widget.received).toEqual([
      { jsonrpc: '2.0', id: 1, error: { code: ERROR_CODES.METHOD_NOT_FOUND, message: 'no such method' } },
    ]);
  });

  it('resolves host-originated request with widget response', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    widgetT.onMessage((m) => {
      const msg = m as { id: unknown; method: string };
      if (msg.method === 'ping') widgetT.send({ jsonrpc: '2.0', id: msg.id, result: 'pong' });
    });
    const bridge = new MessageBridge({ transport: hostT, onRequest: async () => null });
    bridge.start();
    await expect(bridge.request('ping')).resolves.toBe('pong');
  });

  it('logs invalid messages and keeps working', async () => {
    const log: RpcLogEvent[] = [];
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async () => 'ok',
      onLog: (ev) => log.push(ev),
    });
    bridge.start();
    widget.send({ evil: true });
    widget.send({ jsonrpc: '2.0', id: 2, method: 'still/works' });
    await flush();
    expect(log.some((e) => e.kind === 'invalid')).toBe(true);
    expect(widget.received).toEqual([{ jsonrpc: '2.0', id: 2, result: 'ok' }]);
  });

  it('logs directions for request/response pairs', async () => {
    const log: RpcLogEvent[] = [];
    const [hostT, widgetT] = createInMemoryTransportPair();
    widgetSide(widgetT);
    const bridge = new MessageBridge({
      transport: hostT,
      onRequest: async () => 'ok',
      onLog: (ev) => log.push(ev),
      now: () => 123,
    });
    bridge.start();
    widgetT.send({ jsonrpc: '2.0', id: 3, method: 'tools/call' });
    await flush();
    expect(log.map((e) => [e.direction, e.kind])).toEqual([
      ['widget→host', 'request'],
      ['host→widget', 'response'],
    ]);
    expect(log[0]?.ts).toBe(123);
  });

  it('times out host-originated requests', async () => {
    vi.useFakeTimers();
    try {
      const [hostT] = createInMemoryTransportPair();
      const bridge = new MessageBridge({ transport: hostT, onRequest: async () => null, requestTimeoutMs: 1000 });
      bridge.start();
      const p = bridge.request('ping');
      const assertion = expect(p).rejects.toMatchObject({ code: ERROR_CODES.REQUEST_TIMEOUT });
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() unsubscribes and rejects pending requests', async () => {
    const [hostT, widgetT] = createInMemoryTransportPair();
    const widget = widgetSide(widgetT);
    const bridge = new MessageBridge({ transport: hostT, onRequest: async () => 'ok' });
    bridge.start();
    const p = bridge.request('ping');
    const assertion = expect(p).rejects.toBeInstanceOf(RpcError);
    bridge.stop();
    await assertion;
    widget.send({ jsonrpc: '2.0', id: 9, method: 'tools/call' });
    await flush();
    // only the original 'ping' request reached the widget; no response after stop
    expect(widget.received).toHaveLength(1);
  });
});
