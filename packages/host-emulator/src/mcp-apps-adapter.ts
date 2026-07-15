import {
  JSON_RPC_VERSION,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  resourcesReadParamsSchema,
  sizeChangedParamsSchema,
  toolsCallParamsSchema,
  type HostContext,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type WidgetSource,
} from '@studio/shared';
import type { AdapterAction, HostAdapter, HostCapabilities, HostEvent, IframeEnv } from './adapter.js';

function requestId(msg: JsonRpcRequest | JsonRpcNotification): JsonRpcId | undefined {
  return 'id' in msg ? msg.id : undefined;
}

export class McpAppsAdapter implements HostAdapter {
  readonly id = 'mcp-apps' as const;

  buildIframeEnv(widget: WidgetSource, _ctx: HostContext): IframeEnv {
    return widget.kind === 'resource'
      ? { mode: 'srcdoc', content: widget.html, sandbox: ['allow-scripts'] }
      : { mode: 'src', content: widget.url, sandbox: ['allow-scripts'] };
  }

  handleWidgetMessage(msg: JsonRpcRequest | JsonRpcNotification): AdapterAction {
    const id = requestId(msg);
    switch (msg.method) {
      case MCP_APPS_METHODS.uiInitialize:
        return { type: 'initialize', requestId: id ?? 0 };
      case MCP_APPS_METHODS.toolsCall: {
        const p = toolsCallParamsSchema.safeParse(msg.params);
        if (!p.success) return { type: 'invalid-params', requestId: id ?? 0, method: msg.method, error: p.error.message };
        return { type: 'tool-call', requestId: id ?? 0, toolName: p.data.name, args: p.data.arguments };
      }
      case MCP_APPS_METHODS.resourcesRead: {
        const p = resourcesReadParamsSchema.safeParse(msg.params);
        if (!p.success) return { type: 'invalid-params', requestId: id ?? 0, method: msg.method, error: p.error.message };
        return { type: 'resource-read', requestId: id ?? 0, uri: p.data.uri };
      }
      case MCP_APPS_METHODS.sizeChanged: {
        const p = sizeChangedParamsSchema.safeParse(msg.params);
        if (!p.success) return { type: 'invalid-params', requestId: id ?? 0, method: msg.method, error: p.error.message };
        return { type: 'size-changed', ...p.data };
      }
      default:
        return { type: 'unsupported', method: msg.method, ...(id !== undefined ? { requestId: id } : {}) };
    }
  }

  pushHostEvent(ev: HostEvent): JsonRpcNotification | null {
    if (ev.type === 'context-changed') {
      return { jsonrpc: JSON_RPC_VERSION, method: MCP_APPS_METHODS.hostContextChanged, params: ev.context };
    }
    return null;
  }

  buildInitializeResult(ctx: HostContext): unknown {
    return {
      protocolVersion: MCP_APPS_PROTOCOL_VERSION,
      hostCapabilities: {},
      hostInfo: { name: 'mcp-apps-studio', version: '0.1.0' },
      hostContext: ctx,
    };
  }

  capabilities(): HostCapabilities {
    return { displayModes: ['inline', 'fullscreen', 'pip'] };
  }
}
