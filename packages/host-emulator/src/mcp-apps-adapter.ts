import {
  downloadFileParamsSchema,
  formatZodIssues,
  type HostContext,
  JSON_RPC_VERSION,
  type JsonRpcNotification,
  type JsonRpcRequest,
  loggingMessageParamsSchema,
  MCP_APPS_METHODS,
  MCP_APPS_PROTOCOL_VERSION,
  messageParamsSchema,
  openLinkParamsSchema,
  requestDisplayModeParamsSchema,
  resourcesReadParamsSchema,
  sizeChangedParamsSchema,
  toolsCallParamsSchema,
  updateModelContextParamsSchema,
  type WidgetSource,
} from '@studio/shared';
import type { ZodType } from 'zod';
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
        return withParams(msg, toolsCallParamsSchema, (p) => ({
          type: 'tool-call',
          toolName: p.name,
          args: p.arguments,
        }));
      case MCP_APPS_METHODS.resourcesRead:
        return withParams(msg, resourcesReadParamsSchema, (p) => ({ type: 'resource-read', uri: p.uri }));
      case MCP_APPS_METHODS.sizeChanged:
        return withParams(msg, sizeChangedParamsSchema, (p) => ({ type: 'size-changed', ...p }));
      case MCP_APPS_METHODS.initialized:
        return { type: 'initialized' };
      case MCP_APPS_METHODS.openLink:
        return withParams(msg, openLinkParamsSchema, (p) => ({ type: 'open-link', url: p.url }));
      case MCP_APPS_METHODS.message:
        return withParams(msg, messageParamsSchema, (p) => ({ type: 'message', ...p }));
      case MCP_APPS_METHODS.requestDisplayMode:
        return withParams(msg, requestDisplayModeParamsSchema, (p) => ({ type: 'request-display-mode', mode: p.mode }));
      case MCP_APPS_METHODS.updateModelContext:
        return withParams(msg, updateModelContextParamsSchema, (p) => ({ type: 'update-model-context', ...p }));
      case MCP_APPS_METHODS.downloadFile:
        return withParams(msg, downloadFileParamsSchema, (p) => ({ type: 'download-file', contents: p.contents }));
      case MCP_APPS_METHODS.loggingMessage:
        return withParams(msg, loggingMessageParamsSchema, (p) => ({ type: 'log', ...p }));
      case MCP_APPS_METHODS.requestTeardown:
        return { type: 'request-teardown' };
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
      // Everything the emulator answers (see HostEmulator); tools/resources go through mocks or passthrough.
      hostCapabilities: {
        openLinks: {},
        downloadFile: {},
        serverTools: {},
        serverResources: {},
        logging: {},
        message: { text: {}, image: {}, resource: {}, resourceLink: {} },
        updateModelContext: { text: {}, image: {}, resource: {}, resourceLink: {}, structuredContent: {} },
      },
      hostInfo: { name: 'mcp-apps-studio', version: '0.1.0' },
      hostContext: { ...ctx, availableDisplayModes: this.capabilities().displayModes },
    };
  }

  capabilities(): HostCapabilities {
    return { displayModes: ['inline', 'fullscreen', 'pip'] };
  }
}
