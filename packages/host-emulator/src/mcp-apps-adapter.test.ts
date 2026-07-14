import { describe, expect, it } from 'vitest';
import { MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, defaultHostContext } from '@studio/shared';
import { McpAppsAdapter } from './mcp-apps-adapter.js';

const adapter = new McpAppsAdapter();
const req = (id: number, method: string, params?: unknown) => ({ jsonrpc: '2.0' as const, id, method, params });

describe('McpAppsAdapter.handleWidgetMessage', () => {
  it('maps ui/initialize to initialize action', () => {
    expect(adapter.handleWidgetMessage(req(1, MCP_APPS_METHODS.uiInitialize, { appCapabilities: {} }))).toEqual({
      type: 'initialize',
      requestId: 1,
    });
  });

  it('maps tools/call to tool-call action', () => {
    expect(adapter.handleWidgetMessage(req(2, MCP_APPS_METHODS.toolsCall, { name: 'get_metrics', arguments: { q: 1 } }))).toEqual({
      type: 'tool-call',
      requestId: 2,
      toolName: 'get_metrics',
      args: { q: 1 },
    });
  });

  it('maps malformed tools/call params to invalid-params', () => {
    const action = adapter.handleWidgetMessage(req(3, MCP_APPS_METHODS.toolsCall, { arguments: {} }));
    expect(action).toMatchObject({ type: 'invalid-params', requestId: 3, method: MCP_APPS_METHODS.toolsCall });
  });

  it('maps resources/read to resource-read', () => {
    expect(adapter.handleWidgetMessage(req(4, MCP_APPS_METHODS.resourcesRead, { uri: 'ui://kpi' }))).toEqual({
      type: 'resource-read',
      requestId: 4,
      uri: 'ui://kpi',
    });
  });

  it('maps size-changed notification', () => {
    expect(
      adapter.handleWidgetMessage({ jsonrpc: '2.0', method: MCP_APPS_METHODS.sizeChanged, params: { width: 300, height: 200 } }),
    ).toEqual({ type: 'size-changed', width: 300, height: 200 });
  });

  it('maps unknown method to unsupported', () => {
    expect(adapter.handleWidgetMessage(req(5, 'wat/ever'))).toEqual({ type: 'unsupported', method: 'wat/ever', requestId: 5 });
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

  it('builds spec-shaped initialize result', () => {
    expect(adapter.buildInitializeResult(defaultHostContext)).toMatchObject({
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      hostInfo: { name: 'mcp-apps-studio' },
      hostContext: defaultHostContext,
    });
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
