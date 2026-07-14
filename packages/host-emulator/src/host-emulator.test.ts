import { describe, expect, it } from 'vitest';
import { ERROR_CODES, MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, type RpcLogEvent } from '@studio/shared';
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

  it('resolves tools/call from static mock', async () => {
    const { widget } = setup({ mocks: { get_metrics: { kind: 'static', result: { rows: [1, 2] } } } });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics', arguments: {} });
    expect(resp.result).toEqual({ rows: [1, 2] });
  });

  it('returns JSON-RPC error for error mock', async () => {
    const { widget } = setup({ mocks: { get_metrics: { kind: 'error', error: { code: -32000, message: 'db down' } } } });
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 'get_metrics' });
    expect(resp.error).toMatchObject({ code: -32000, message: 'db down' });
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
    emulator.setHostContext({ theme: 'dark' });
    await flush();
    expect(widget.inbox).toContainEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.hostContextChanged,
      params: { theme: 'dark' },
    });
    expect(emulator.getHostContext().theme).toBe('dark');
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

  it('survives garbage messages and logs them as invalid', async () => {
    const { widget, widgetT, log } = setup({ mocks: { t: { kind: 'static', result: 'ok' } } });
    widgetT.send({ totally: 'garbage' });
    await flush();
    expect(log.filter((e) => e.kind === 'invalid')).toHaveLength(1);
    const resp = await widget.request(MCP_APPS_METHODS.toolsCall, { name: 't' });
    expect(resp.result).toBe('ok');
  });
});
