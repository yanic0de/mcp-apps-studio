import { App } from '@modelcontextprotocol/ext-apps';
import type { Transport as SdkTransport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { HostContext, MockConfig, RpcLogEvent, ToolCall } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import type { WidgetIntent } from './adapter.js';
import { HostEmulator } from './host-emulator.js';
import { McpAppsAdapter } from './mcp-apps-adapter.js';
import { createInMemoryTransportPair, type Transport } from './transport.js';

/**
 * The official ext-apps `App` is the reference View. If the SDK and the emulator
 * drift apart (method names, result shapes, capability schema), these tests fail.
 */

/** Wraps our in-memory transport end in the MCP SDK Transport interface the App expects. */
function sdkTransport(end: Transport): SdkTransport {
  let off: (() => void) | undefined;
  const t: SdkTransport = {
    async start() {
      off = end.onMessage((m) => t.onmessage?.(m as JSONRPCMessage));
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

async function connectApp(
  opts: { mocks?: MockConfig; hostContext?: HostContext; toolCall?: ToolCall; beforeConnect?: (app: App) => void } = {},
) {
  const [hostEnd, appEnd] = createInMemoryTransportPair();
  const log: RpcLogEvent[] = [];
  const intents: WidgetIntent[] = [];
  const emulator = new HostEmulator({
    adapter: new McpAppsAdapter(),
    transport: hostEnd,
    mocks: opts.mocks,
    hostContext: opts.hostContext,
    toolCall: opts.toolCall,
    onLog: (ev) => log.push(ev),
    onWidgetIntent: (i) => intents.push(i),
  });
  emulator.start();
  const app = new App({ name: 'conformance', version: '1.0.0' }, {}, { autoResize: false });
  opts.beforeConnect?.(app);
  await app.connect(sdkTransport(appEnd));
  await new Promise((r) => setTimeout(r, 0)); // let `initialized` land
  return { app, emulator, log, intents };
}

const invalid = (log: RpcLogEvent[]) => log.filter((e) => e.kind === 'invalid');

describe('ext-apps App against HostEmulator', () => {
  it('handshakes: context delivered, capabilities advertised, widget ready, clean trace', async () => {
    const { app, emulator, log } = await connectApp({
      hostContext: { theme: 'dark', locale: 'en', displayMode: 'inline' },
    });
    expect(app.getHostContext()?.theme).toBe('dark');
    expect(app.getHostCapabilities()).toMatchObject({ openLinks: {}, serverTools: {} });
    expect(emulator.isReady()).toBe(true);
    expect(invalid(log)).toEqual([]);
  });

  it('calls a tool and gets structured content', async () => {
    const { app } = await connectApp({ mocks: { get_metrics: { kind: 'static', structuredContent: { v: 1 } } } });
    const result = await app.callServerTool({ name: 'get_metrics', arguments: {} });
    expect(result.structuredContent).toEqual({ v: 1 });
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });

  it('gets a tool failure as an isError result, not a rejection', async () => {
    const { app } = await connectApp({ mocks: { get_metrics: { kind: 'error', message: 'db down' } } });
    const result = await app.callServerTool({ name: 'get_metrics', arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'db down' }]);
  });

  it('switches display mode and receives the context change', async () => {
    const { app } = await connectApp();
    const changes: unknown[] = [];
    app.onhostcontextchanged = (params) => changes.push(params);
    await expect(app.requestDisplayMode({ mode: 'fullscreen' })).resolves.toMatchObject({ mode: 'fullscreen' });
    await new Promise((r) => setTimeout(r, 0));
    expect(changes).toContainEqual({ displayMode: 'fullscreen' });
  });

  it('opens links, sends messages, updates model context, logs', async () => {
    const { app, intents, log } = await connectApp();
    await app.openLink({ url: 'https://example.com' });
    await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    await app.updateModelContext({ structuredContent: { selected: 3 } });
    await app.sendLog({ level: 'info', data: 'hello' });
    await new Promise((r) => setTimeout(r, 0));
    expect(intents.map((i) => i.type)).toEqual(['open-link', 'message', 'update-model-context', 'log']);
    expect(invalid(log)).toEqual([]);
  });

  it('receives the tool lifecycle: input, then result, with toolInfo in the context', async () => {
    const events: unknown[] = [];
    const { app, log } = await connectApp({
      toolCall: { name: 'get_metrics', input: { q: 1 }, result: { kind: 'static', structuredContent: { v: 1 } } },
      beforeConnect: (a) => {
        a.ontoolinput = (p) => events.push(['input', p.arguments]);
        a.ontoolresult = (p) => events.push(['result', p.structuredContent]);
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toEqual([
      ['input', { q: 1 }],
      ['result', { v: 1 }],
    ]);
    expect(app.getHostContext()?.toolInfo?.tool.name).toBe('get_metrics');
    expect(invalid(log)).toEqual([]);
  });

  it('receives tool-cancelled', async () => {
    const reasons: unknown[] = [];
    await connectApp({
      toolCall: { name: 't', result: { kind: 'cancelled', reason: 'user' } },
      beforeConnect: (a) => {
        a.ontoolcancelled = (p) => reasons.push(p.reason);
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(reasons).toEqual(['user']);
  });
});
