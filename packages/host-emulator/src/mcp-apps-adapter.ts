import type { ZodType } from 'zod';
import {
  JSON_RPC_VERSION,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  formatZodIssues,
  resourcesReadParamsSchema,
  sizeChangedParamsSchema,
  toolsCallParamsSchema,
  type HostContext,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type WidgetSource,
} from '@studio/shared';
import type { AdapterAction, HostAdapter, HostCapabilities, HostEvent, IframeEnv } from './adapter.js';

type WireMessage = JsonRpcRequest | JsonRpcNotification;

/** Validates `msg.params` against `schema`; malformed params become an `invalid-params` action. */
function withParams<T>(msg: WireMessage, schema: ZodType<T>, build: (params: T) => AdapterAction): AdapterAction {
  const parsed = schema.safeParse(msg.params);
  if (!parsed.success) {
    return { type: 'invalid-params', method: msg.method, error: formatZodIssues(parsed.error) };
  }
  return build(parsed.data);
}

export class McpAppsAdapter implements HostAdapter {
  readonly id = 'mcp-apps' as const;

  buildIframeEnv(widget: WidgetSource, _ctx: HostContext): IframeEnv {
    return widget.kind === 'resource'
      ? { mode: 'srcdoc', content: widget.html, sandbox: ['allow-scripts'] }
      : { mode: 'src', content: widget.url, sandbox: ['allow-scripts'] };
  }

  handleWidgetMessage(msg: WireMessage): AdapterAction {
    switch (msg.method) {
      case MCP_APPS_METHODS.uiInitialize:
        return { type: 'initialize' };
      case MCP_APPS_METHODS.toolsCall:
        return withParams(msg, toolsCallParamsSchema, (p) => ({ type: 'tool-call', toolName: p.name, args: p.arguments }));
      case MCP_APPS_METHODS.resourcesRead:
        return withParams(msg, resourcesReadParamsSchema, (p) => ({ type: 'resource-read', uri: p.uri }));
      case MCP_APPS_METHODS.sizeChanged:
        return withParams(msg, sizeChangedParamsSchema, (p) => ({ type: 'size-changed', ...p }));
      default:
        return { type: 'unsupported', method: msg.method };
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
