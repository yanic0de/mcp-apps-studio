import { ERROR_CODES, MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, type RpcLogEvent } from '@studio/shared';
import { describe, expect, it, vi } from 'vitest';
import { HostEmulator, type HostEmulatorOptions } from './host-emulator.js';
import { McpAppsAdapter } from './mcp-apps-adapter.js';
import { createInMemoryTransportPair, type Transport } from './transport.js';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

interface WireMessage {
  id?: unknown;
  method?: string;
  params?: unknown;
  result?: any;
  error?: { code: number; message: string };
}

/** Minimal fake widget speaking raw JSON-RPC, like a real iframe would. */
function fakeWidget(t: Transport) {
  const inbox: WireMessage[] = [];
  t.onMessage((m) => inbox.push(m as WireMessage));
  let nextId = 0;
  return {
    inbox,
    async request(method: string, params?: unknown): Promise<WireMessage> {
      const id = `w${++nextId}`;
      t.send({ jsonrpc: '2.0', id, method, params });
      await flush();
      const resp = inbox.find((m) => m.id === id);
      if (!resp) throw new Error(`no response for ${method}`);
      return resp;
    },
    notify(method: string, params?: unknown) {
      t.send({ jsonrpc: '2.0', method, params });
    },
  };
}

/** ui/initialize → initialized, like the SDK's App.connect(). */
async function handshake(widget: ReturnType<typeof fakeWidget>): Promise<WireMessage> {
  const resp = await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
  widget.notify(MCP_APPS_METHODS.initialized);
  await flush();
  return resp;
}

function setup(opts: Partial<HostEmulatorOptions> = {}) {
  const [hostT, widgetT] = createInMemoryTransportPair();
  const log: RpcLogEvent[] = [];
  const emulator = new HostEmulator({
    adapter: new McpAppsAdapter(),
    transport: hostT,
    onLog: (ev) => log.push(ev),
    ...opts,
  });
  emulator.start();
  return { emulator, widget: fakeWidget(widgetT), widgetT, log };
}

describe('HostEmulator', () => {
  it('answers ui/initialize with protocol version and host context', async () => {
    const { widget } = setup();
    const resp = await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
    expect(resp.result.protocolVersion).toBe(MCP_APPS_PROTOCOL_VERSION);
    expect(resp.result.hostContext.theme).toBe('light');
  });

  it('resolves tools/call from static mock as a CallToolResult', async () => {
    const { widget } = setup({ mocks: { get_metrics: { kind: 'static', structuredContent: { rows: [1, 2] } } } });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics', arguments: {} });
    expect(resp.result.structuredContent).toEqual({ rows: [1, 2] });
    expect(resp.result.content[0].type).toBe('text');
  });

  it('answers an error mock with an isError result, not a JSON-RPC error', async () => {
    const { widget } = setup({ mocks: { get_metrics: { kind: 'error', message: 'db down' } } });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics' });
    expect(resp.error).toBeUndefined();
    expect(resp.result).toEqual({ isError: true, content: [{ type: 'text', text: 'db down' }] });
  });

  it('returns JSON-RPC error for rpc-error mock', async () => {
    const { widget } = setup({
      mocks: { get_metrics: { kind: 'rpc-error', error: { code: -32000, message: 'db down' } } },
    });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics' });
    expect(resp.error).toMatchObject({ code: -32000, message: 'db down' });
  });

  it('marks the widget ready on ui/notifications/initialized without trace errors', async () => {
    const { emulator, widget, log } = setup();
    expect(emulator.isReady()).toBe(false);
    await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
    widget.notify(MCP_APPS_METHODS.initialized);
    await flush();
    expect(emulator.isReady()).toBe(true);
    expect(log.filter((e) => e.kind === 'invalid')).toEqual([]);
  });

  it('reports widget intents and answers them with success', async () => {
    const intents: unknown[] = [];
    const { widget } = setup({ onWidgetIntent: (a) => intents.push(a) });
    const link = await widget.request(MCP_APPS_METHODS.openLink, { url: 'https://example.com' });
    const msg = await widget.request(MCP_APPS_METHODS.message, {
      role: 'user',
      content: [{ type: 'text', text: 'hi' }],
    });
    const ctx = await widget.request(MCP_APPS_METHODS.updateModelContext, { structuredContent: { a: 1 } });
    const dl = await widget.request(MCP_APPS_METHODS.downloadFile, { contents: [] });
    for (const r of [link, msg, ctx, dl]) expect(r.result).toEqual({});
    expect(intents).toEqual([
      { type: 'open-link', url: 'https://example.com' },
      { type: 'message', role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { type: 'update-model-context', structuredContent: { a: 1 } },
      { type: 'download-file', contents: [] },
    ]);
  });

  it('reports log and teardown-request notifications as intents', async () => {
    const intents: unknown[] = [];
    const { widget, log } = setup({ onWidgetIntent: (a) => intents.push(a) });
    widget.notify(MCP_APPS_METHODS.loggingMessage, { level: 'info', data: 'hello' });
    widget.notify(MCP_APPS_METHODS.requestTeardown);
    await flush();
    expect(intents).toEqual([{ type: 'log', level: 'info', data: 'hello' }, { type: 'request-teardown' }]);
    expect(log.filter((e) => e.kind === 'invalid')).toEqual([]);
  });

  it('switches display mode on request and tells both the widget and the embedder', async () => {
    const changed: unknown[] = [];
    const { emulator, widget } = setup({ onHostContextChanged: (c) => changed.push(c) });
    await handshake(widget);
    const resp = await widget.request(MCP_APPS_METHODS.requestDisplayMode, { mode: 'fullscreen' });
    expect(resp.result).toEqual({ mode: 'fullscreen' });
    expect(emulator.getHostContext().displayMode).toBe('fullscreen');
    expect(widget.inbox).toContainEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.hostContextChanged,
      params: { displayMode: 'fullscreen' },
    });
    expect(changed).toEqual([emulator.getHostContext()]);
  });

  it('declines a display mode the host does not offer, keeping the current one', async () => {
    const changed: unknown[] = [];
    const adapter = new McpAppsAdapter();
    adapter.capabilities = () => ({ displayModes: ['inline'] });
    const { emulator, widget } = setup({ adapter, onHostContextChanged: (c) => changed.push(c) });
    const resp = await widget.request(MCP_APPS_METHODS.requestDisplayMode, { mode: 'pip' });
    expect(resp.result).toEqual({ mode: 'inline' });
    expect(emulator.getHostContext().displayMode).toBe('inline');
    expect(changed).toEqual([]);
  });

  it('serves resources/read from configured resources', async () => {
    const { widget } = setup({ resources: { 'ui://kpi': '<html>kpi</html>' } });
    const resp = await widget.request(MCP_APPS_METHODS.resourcesRead, { uri: 'ui://kpi' });
    expect(resp.result.contents[0]).toMatchObject({ uri: 'ui://kpi', text: '<html>kpi</html>' });
    const missing = await widget.request(MCP_APPS_METHODS.resourcesRead, { uri: 'ui://ghost' });
    expect(missing.error?.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('pushes host-context-changed notification on setHostContext', async () => {
    const { emulator, widget } = setup();
    await handshake(widget);
    emulator.setHostContext({ theme: 'dark' });
    await flush();
    expect(widget.inbox).toContainEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.hostContextChanged,
      params: { theme: 'dark' },
    });
    expect(emulator.getHostContext().theme).toBe('dark');
  });

  describe('host context around the handshake', () => {
    const contextChanges = (inbox: WireMessage[]) =>
      inbox.filter((m) => m.method === MCP_APPS_METHODS.hostContextChanged);

    it('does not notify before the handshake; the initialize result carries the change', async () => {
      const { emulator, widget } = setup();
      emulator.setHostContext({ theme: 'dark' });
      await flush();
      expect(contextChanges(widget.inbox)).toEqual([]);
      const resp = await handshake(widget);
      expect(resp.result.hostContext.theme).toBe('dark');
      expect(contextChanges(widget.inbox)).toEqual([]);
    });

    it('delivers a change made during the handshake right after initialized', async () => {
      const { emulator, widget } = setup();
      await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
      emulator.setHostContext({ theme: 'dark' });
      await flush();
      expect(contextChanges(widget.inbox)).toEqual([]);
      widget.notify(MCP_APPS_METHODS.initialized);
      await flush();
      expect(contextChanges(widget.inbox)).toEqual([
        { jsonrpc: '2.0', method: MCP_APPS_METHODS.hostContextChanged, params: { theme: 'dark' } },
      ]);
    });

    it('sends nothing after initialized when the context is what the widget already got', async () => {
      const { emulator, widget } = setup();
      await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
      emulator.setHostContext({ theme: 'dark' });
      emulator.setHostContext({ theme: 'light' });
      widget.notify(MCP_APPS_METHODS.initialized);
      await flush();
      expect(contextChanges(widget.inbox)).toEqual([]);
    });

    it('does not notify after stop but still updates the context', async () => {
      const { emulator, widget } = setup();
      await handshake(widget);
      emulator.stop();
      emulator.setHostContext({ theme: 'dark' });
      await flush();
      expect(contextChanges(widget.inbox)).toEqual([]);
      expect(emulator.getHostContext().theme).toBe('dark');
    });
  });

  it('reports size-changed notifications', async () => {
    const sizes: unknown[] = [];
    const { widget } = setup({ onSizeChanged: (s) => sizes.push(s) });
    widget.notify(MCP_APPS_METHODS.sizeChanged, { width: 320, height: 240 });
    await flush();
    expect(sizes).toEqual([{ width: 320, height: 240 }]);
  });

  it('rejects unsupported methods with METHOD_NOT_FOUND', async () => {
    const { widget } = setup();
    const resp = await widget.request('wat/ever');
    expect(resp.error?.code).toBe(ERROR_CODES.METHOD_NOT_FOUND);
  });

  it('rejects malformed tools/call params with INVALID_PARAMS', async () => {
    const { widget } = setup();
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { arguments: {} });
    expect(resp.error?.code).toBe(ERROR_CODES.INVALID_PARAMS);
  });

  it('logs size-changed with malformed params as invalid and does not report a size', async () => {
    const sizes: unknown[] = [];
    const { widget, log } = setup({ onSizeChanged: (s) => sizes.push(s) });
    widget.notify(MCP_APPS_METHODS.sizeChanged, { width: 'wide' });
    await flush();
    expect(sizes).toEqual([]);
    const invalid = log.filter((e) => e.kind === 'invalid');
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toMatchObject({ direction: 'widget→host', method: MCP_APPS_METHODS.sizeChanged });
  });

  it('logs unknown notification methods as invalid', async () => {
    const { widget, log } = setup();
    widget.notify('wat/notification');
    await flush();
    const invalid = log.filter((e) => e.kind === 'invalid');
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toMatchObject({ method: 'wat/notification' });
  });

  it('survives garbage messages and logs them as invalid', async () => {
    const { widget, widgetT, log } = setup({ mocks: { t: { kind: 'static', structuredContent: { ok: true } } } });
    widgetT.send({ totally: 'garbage' });
    await flush();
    expect(log.filter((e) => e.kind === 'invalid')).toHaveLength(1);
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 't' });
    expect(resp.result.structuredContent).toEqual({ ok: true });
  });

  describe('tool lifecycle', () => {
    const lifecycle = (inbox: WireMessage[]) =>
      inbox.filter((m) => m.method?.startsWith('ui/notifications/tool-')).map((m) => [m.method, m.params]);

    async function initialize(widget: ReturnType<typeof fakeWidget>) {
      await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
      widget.notify(MCP_APPS_METHODS.initialized);
      await flush();
      await flush();
    }

    it('sends nothing before initialized and plays partials → input → result after it', async () => {
      const { widget } = setup({
        toolCall: {
          name: 'get_metrics',
          input: { q: 'ab' },
          partialInputs: [{ q: 'a' }, { q: 'ab' }],
          result: { kind: 'static', structuredContent: { v: 1 } },
        },
      });
      await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
      expect(lifecycle(widget.inbox)).toEqual([]);
      widget.notify(MCP_APPS_METHODS.initialized);
      await flush();
      await flush();
      expect(lifecycle(widget.inbox)).toEqual([
        [MCP_APPS_METHODS.toolInputPartial, { arguments: { q: 'a' } }],
        [MCP_APPS_METHODS.toolInputPartial, { arguments: { q: 'ab' } }],
        [MCP_APPS_METHODS.toolInput, { arguments: { q: 'ab' } }],
        [MCP_APPS_METHODS.toolResult, { content: [{ type: 'text', text: '{"v":1}' }], structuredContent: { v: 1 } }],
      ]);
    });

    it('sends only tool-input (default {}) when the call has no result', async () => {
      const { widget } = setup({ toolCall: { name: 'get_metrics' } });
      await initialize(widget);
      expect(lifecycle(widget.inbox)).toEqual([[MCP_APPS_METHODS.toolInput, { arguments: {} }]]);
    });

    it('sends an isError tool-result for an error result', async () => {
      const { widget } = setup({ toolCall: { name: 't', result: { kind: 'error', message: 'db down' } } });
      await initialize(widget);
      expect(lifecycle(widget.inbox).at(-1)).toEqual([
        MCP_APPS_METHODS.toolResult,
        { isError: true, content: [{ type: 'text', text: 'db down' }] },
      ]);
    });

    it('sends tool-cancelled with the reason for a cancelled result', async () => {
      const { widget } = setup({ toolCall: { name: 't', result: { kind: 'cancelled', reason: 'user' } } });
      await initialize(widget);
      expect(lifecycle(widget.inbox).at(-1)).toEqual([MCP_APPS_METHODS.toolCancelled, { reason: 'user' }]);
    });

    it('passes input to passthrough and turns its failure into tool-cancelled', async () => {
      const calls: unknown[] = [];
      const { widget } = setup({
        toolCall: { name: 'live_tool', input: { a: 1 }, result: { kind: 'passthrough' } },
        passthrough: async (name, args) => {
          calls.push([name, args]);
          throw new Error('boom');
        },
      });
      await initialize(widget);
      expect(calls).toEqual([['live_tool', { a: 1 }]]);
      expect(lifecycle(widget.inbox).at(-1)).toEqual([MCP_APPS_METHODS.toolCancelled, { reason: 'boom' }]);
    });

    it('does not send a pending result after stop', async () => {
      vi.useFakeTimers();
      try {
        const { emulator, widget } = setup({
          toolCall: { name: 't', result: { kind: 'static', structuredContent: {}, delayMs: 1000 } },
        });
        const init = widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
        await vi.advanceTimersByTimeAsync(1);
        await init;
        widget.notify(MCP_APPS_METHODS.initialized);
        await vi.advanceTimersByTimeAsync(10);
        emulator.stop();
        await vi.advanceTimersByTimeAsync(2000);
        expect(lifecycle(widget.inbox).map(([m]) => m)).toEqual([MCP_APPS_METHODS.toolInput]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('replays the lifecycle for a new view instance (the iframe reloaded and handshook again)', async () => {
      const { widget } = setup({ toolCall: { name: 't', input: { q: 1 } } });
      await initialize(widget);
      await initialize(widget); // e.g. the dev server's HMR reloaded the frame
      expect(lifecycle(widget.inbox)).toHaveLength(2);
    });

    it('does not replay the lifecycle on a repeated initialized', async () => {
      const { widget } = setup({ toolCall: { name: 't' } });
      await initialize(widget);
      widget.notify(MCP_APPS_METHODS.initialized);
      await flush();
      expect(lifecycle(widget.inbox)).toHaveLength(1);
    });

    it('puts toolInfo into the initialize result only', async () => {
      const { emulator, widget } = setup({ toolCall: { name: 'get_metrics' } });
      const resp = await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
      expect(resp.result.hostContext.toolInfo).toEqual({
        tool: { name: 'get_metrics', inputSchema: { type: 'object' } },
      });
      expect(emulator.getHostContext()).not.toHaveProperty('toolInfo');
    });

    it('uses a provided tool definition for toolInfo', async () => {
      const tool = { name: 'get_metrics', description: 'd', inputSchema: { type: 'object', properties: {} } };
      const { widget } = setup({ toolCall: { name: 'get_metrics' }, toolDefinition: tool });
      const resp = await widget.request(MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} });
      expect(resp.result.hostContext.toolInfo).toEqual({ tool });
    });
  });
});
