import { defaultHostContext, MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { McpAppsAdapter } from './mcp-apps-adapter.js';

const adapter = new McpAppsAdapter();
const req = (id: number, method: string, params?: unknown) => ({ jsonrpc: '2.0' as const, id, method, params });

describe('McpAppsAdapter.handleWidgetMessage', () => {
  it('maps ui/initialize to initialize action', () => {
    expect(adapter.handleWidgetMessage(req(1, MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} }))).toEqual({
      type: 'initialize',
    });
  });

  it('maps tools/call to tool-call action', () => {
    expect(
      adapter.handleWidgetMessage(req(2, MCP_APPS_METHODS.toolsCall, { name: 'get_metrics', arguments: { q: 1 } })),
    ).toEqual({
      type: 'tool-call',
      toolName: 'get_metrics',
      args: { q: 1 },
    });
  });

  it('maps malformed tools/call params to invalid-params', () => {
    const action = adapter.handleWidgetMessage(req(3, MCP_APPS_METHODS.toolsCall, { arguments: {} }));
    expect(action).toMatchObject({ type: 'invalid-params', method: MCP_APPS_METHODS.toolsCall });
    expect((action as { error: string }).error).toMatch(/name/); // names the offending field
  });

  it('maps resources/read to resource-read', () => {
    expect(adapter.handleWidgetMessage(req(4, MCP_APPS_METHODS.resourcesRead, { uri: 'ui://kpi' }))).toEqual({
      type: 'resource-read',
      uri: 'ui://kpi',
    });
  });

  it('maps size-changed notification', () => {
    expect(
      adapter.handleWidgetMessage({
        jsonrpc: '2.0',
        method: MCP_APPS_METHODS.sizeChanged,
        params: { width: 300, height: 200 },
      }),
    ).toEqual({ type: 'size-changed', width: 300, height: 200 });
  });

  it('maps malformed size-changed params to invalid-params', () => {
    const action = adapter.handleWidgetMessage({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.sizeChanged,
      params: { width: 'wide' },
    });
    expect(action).toMatchObject({ type: 'invalid-params', method: MCP_APPS_METHODS.sizeChanged });
  });

  it('maps ui/notifications/initialized to initialized', () => {
    expect(adapter.handleWidgetMessage({ jsonrpc: '2.0', method: MCP_APPS_METHODS.initialized })).toEqual({
      type: 'initialized',
    });
  });

  it('maps widget intents to semantic actions', () => {
    expect(adapter.handleWidgetMessage(req(6, MCP_APPS_METHODS.openLink, { url: 'https://example.com' }))).toEqual({
      type: 'open-link',
      url: 'https://example.com',
    });
    const content = [{ type: 'text', text: 'hi' }];
    expect(adapter.handleWidgetMessage(req(7, MCP_APPS_METHODS.message, { role: 'user', content }))).toEqual({
      type: 'message',
      role: 'user',
      content,
    });
    expect(adapter.handleWidgetMessage(req(8, MCP_APPS_METHODS.requestDisplayMode, { mode: 'pip' }))).toEqual({
      type: 'request-display-mode',
      mode: 'pip',
    });
    expect(
      adapter.handleWidgetMessage(req(9, MCP_APPS_METHODS.updateModelContext, { structuredContent: { a: 1 } })),
    ).toEqual({ type: 'update-model-context', structuredContent: { a: 1 } });
    expect(adapter.handleWidgetMessage(req(10, MCP_APPS_METHODS.downloadFile, { contents: [] }))).toEqual({
      type: 'download-file',
      contents: [],
    });
  });

  it('maps logging and teardown-request notifications', () => {
    expect(
      adapter.handleWidgetMessage({
        jsonrpc: '2.0',
        method: MCP_APPS_METHODS.loggingMessage,
        params: { level: 'info', data: 'hello' },
      }),
    ).toEqual({ type: 'log', level: 'info', data: 'hello' });
    expect(adapter.handleWidgetMessage({ jsonrpc: '2.0', method: MCP_APPS_METHODS.requestTeardown })).toEqual({
      type: 'request-teardown',
    });
  });

  it('maps a malformed open-link to invalid-params naming url', () => {
    const action = adapter.handleWidgetMessage(req(11, MCP_APPS_METHODS.openLink, { url: 'nope' }));
    expect(action).toMatchObject({ type: 'invalid-params', method: MCP_APPS_METHODS.openLink });
    expect((action as { error: string }).error).toMatch(/url/);
  });

  it('maps unknown method to unsupported', () => {
    expect(adapter.handleWidgetMessage(req(5, 'wat/ever'))).toEqual({ type: 'unsupported', method: 'wat/ever' });
  });
});

describe('McpAppsAdapter host-side translation', () => {
  it('translates context-changed event to wire notification', () => {
    expect(adapter.pushHostEvent({ type: 'context-changed', context: { theme: 'dark' } })).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.hostContextChanged,
      params: { theme: 'dark' },
    });
  });

  it('translates tool lifecycle events to wire notifications', () => {
    expect(adapter.pushHostEvent({ type: 'tool-input-partial', arguments: { q: 'a' } })).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.toolInputPartial,
      params: { arguments: { q: 'a' } },
    });
    expect(adapter.pushHostEvent({ type: 'tool-input', arguments: { q: 1 } })).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.toolInput,
      params: { arguments: { q: 1 } },
    });
    const result = { content: [], structuredContent: { v: 1 } };
    expect(adapter.pushHostEvent({ type: 'tool-result', result })).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.toolResult,
      params: result,
    });
    expect(adapter.pushHostEvent({ type: 'tool-cancelled', reason: 'user' })).toEqual({
      jsonrpc: '2.0',
      method: MCP_APPS_METHODS.toolCancelled,
      params: { reason: 'user' },
    });
    expect(adapter.pushHostEvent({ type: 'tool-cancelled' })).toMatchObject({ params: {} });
  });

  it('builds spec-shaped initialize result', () => {
    const result = adapter.buildInitializeResult(defaultHostContext) as {
      hostContext: Record<string, unknown>;
      hostCapabilities: Record<string, unknown>;
    };
    expect(result).toMatchObject({
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      hostInfo: { name: 'mcp-apps-studio' },
      hostContext: { ...defaultHostContext, availableDisplayModes: adapter.capabilities().displayModes },
    });
    expect(result.hostContext.platform).toBe('web');
    expect(Object.keys(result.hostCapabilities).sort()).toEqual(
      [
        'downloadFile',
        'logging',
        'message',
        'openLinks',
        'serverResources',
        'serverTools',
        'updateModelContext',
      ].sort(),
    );
  });

  it('builds sandboxed iframe env for resource and dev widgets', () => {
    expect(adapter.buildIframeEnv({ kind: 'resource', uri: 'ui://kpi', html: '<html/>' }, defaultHostContext)).toEqual({
      mode: 'srcdoc',
      content: '<html/>',
      sandbox: ['allow-scripts'],
    });
    expect(adapter.buildIframeEnv({ kind: 'dev', url: 'http://localhost:5173/kpi' }, defaultHostContext)).toEqual({
      mode: 'src',
      content: 'http://localhost:5173/kpi',
      sandbox: ['allow-scripts'],
    });
  });
});
