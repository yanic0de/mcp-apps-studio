import { describe, expect, it, vi } from 'vitest';
import { MCP_APPS_METHODS, type HostContext } from '@studio/shared';
import { RpcError } from '@studio/shared';
import { WidgetClient, type WidgetWindow } from './client.js';

const ctx: HostContext = { theme: 'dark', locale: 'en', displayMode: 'inline' };

function fakeEnv() {
  const listeners = new Set<(ev: MessageEvent) => void>();
  const sent: any[] = [];
  const win: WidgetWindow = {
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
    parent: { postMessage: (m: unknown) => void sent.push(m) },
  };
  const reply = (data: unknown) => {
    for (const l of [...listeners]) l({ data } as MessageEvent);
  };
  return { win, sent, reply, listeners };
}

describe('WidgetClient', () => {
  it('connect performs ui/initialize handshake and stores host context', async () => {
    const { win, sent, reply } = fakeEnv();
    const client = new WidgetClient(win);
    const p = client.connect();
    expect(sent[0]).toMatchObject({ jsonrpc: '2.0', method: MCP_APPS_METHODS.uiInitialize });
    reply({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostContext: ctx } });
    await expect(p).resolves.toEqual(ctx);
    expect(client.getHostContext()).toEqual(ctx);
  });

  it('callTool sends tools/call and resolves the result', async () => {
    const { win, sent, reply } = fakeEnv();
    const client = new WidgetClient(win);
    const p = client.callTool('get_metrics', { q: 1 });
    expect(sent[0]).toMatchObject({ method: MCP_APPS_METHODS.toolsCall, params: { name: 'get_metrics', arguments: { q: 1 } } });
    reply({ jsonrpc: '2.0', id: sent[0].id, result: { value: 1 } });
    await expect(p).resolves.toEqual({ value: 1 });
  });

  it('callTool rejects with RpcError on error response', async () => {
    const { win, sent, reply } = fakeEnv();
    const client = new WidgetClient(win);
    const p = client.callTool('get_metrics');
    reply({ jsonrpc: '2.0', id: sent[0].id, error: { code: -32000, message: 'boom' } });
    await expect(p).rejects.toBeInstanceOf(RpcError);
    await expect(p.catch((e: RpcError) => e.code)).resolves.toBe(-32000);
  });

  it('merges host-context-changed patches and notifies listeners', async () => {
    const { win, sent, reply } = fakeEnv();
    const client = new WidgetClient(win);
    const p = client.connect();
    reply({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: 'x', hostContext: ctx } });
    await p;
    const patches: unknown[] = [];
    const off = client.onHostContextChanged((patch) => patches.push(patch));
    reply({ jsonrpc: '2.0', method: MCP_APPS_METHODS.hostContextChanged, params: { theme: 'light' } });
    expect(client.getHostContext()).toMatchObject({ theme: 'light', locale: 'en' });
    expect(patches).toEqual([{ theme: 'light' }]);
    off();
    reply({ jsonrpc: '2.0', method: MCP_APPS_METHODS.hostContextChanged, params: { theme: 'dark' } });
    expect(patches).toHaveLength(1);
  });

  it('sendSizeChanged posts the wire notification', () => {
    const { win, sent } = fakeEnv();
    new WidgetClient(win).sendSizeChanged({ width: 320, height: 200 });
    expect(sent[0]).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.sizeChanged,
      params: { width: 320, height: 200 },
    });
  });

  it('dispose unsubscribes and rejects pending calls', async () => {
    const { win, listeners } = fakeEnv();
    const client = new WidgetClient(win);
    const p = client.callTool('slow');
    const assertion = expect(p).rejects.toThrow(/disposed/);
    client.dispose();
    await assertion;
    expect(listeners.size).toBe(0);
  });

  it('rejects a request that gets no response within the timeout', async () => {
    vi.useFakeTimers();
    try {
      const { win } = fakeEnv();
      const client = new WidgetClient(win, { requestTimeoutMs: 1000 });
      const p = client.callTool('never_answers');
      const assertion = expect(p).rejects.toThrow(/timed out/);
      vi.advanceTimersByTime(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not fire the timeout after a response arrived', async () => {
    vi.useFakeTimers();
    try {
      const { win, sent, reply } = fakeEnv();
      const client = new WidgetClient(win, { requestTimeoutMs: 1000 });
      const p = client.callTool('fast');
      reply({ jsonrpc: '2.0', id: sent[0].id, result: 'ok' });
      vi.advanceTimersByTime(5000);
      await expect(p).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores garbage messages', () => {
    const { win, reply } = fakeEnv();
    const client = new WidgetClient(win);
    expect(() => {
      reply(null);
      reply({ evil: true });
      reply({ jsonrpc: '2.0', id: 'unknown', result: 1 });
    }).not.toThrow();
    expect(client.getHostContext()).toBeNull();
  });
});

describe('WidgetClient send failures', () => {
  it('rejects the call when postMessage throws instead of leaving it pending', async () => {
    const { win } = fakeEnv();
    win.parent.postMessage = () => {
      throw new Error('DataCloneError');
    };
    const client = new WidgetClient(win);
    await expect(client.callTool('x', { fn: () => 1 })).rejects.toThrow('DataCloneError');
  });
});
