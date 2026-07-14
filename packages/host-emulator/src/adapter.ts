import type { HostContext, JsonRpcId, JsonRpcNotification, JsonRpcRequest, WidgetSource } from '@studio/shared';

export type AdapterId = 'mcp-apps' | 'openai-apps' | 'mcp-ui-legacy';

export interface IframeEnv {
  mode: 'srcdoc' | 'src';
  content: string;
  sandbox: string[];
  csp?: string;
}

export type AdapterAction =
  | { type: 'initialize'; requestId: JsonRpcId }
  | { type: 'tool-call'; requestId: JsonRpcId; toolName: string; args: unknown }
  | { type: 'resource-read'; requestId: JsonRpcId; uri: string }
  | { type: 'size-changed'; width?: number; height?: number }
  | { type: 'invalid-params'; requestId: JsonRpcId; method: string; error: string }
  | { type: 'unsupported'; method: string; requestId?: JsonRpcId };

export type HostEvent = { type: 'context-changed'; context: Partial<HostContext> };

export interface HostCapabilities {
  displayModes: HostContext['displayMode'][];
}

/**
 * Pure translator between wire messages and semantic actions.
 * No transport access, no side effects — testable against golden logs.
 */
export interface HostAdapter {
  readonly id: AdapterId;
  buildIframeEnv(widget: WidgetSource, ctx: HostContext): IframeEnv;
  handleWidgetMessage(msg: JsonRpcRequest | JsonRpcNotification): AdapterAction;
  pushHostEvent(ev: HostEvent): JsonRpcNotification | null;
  buildInitializeResult(ctx: HostContext): unknown;
  capabilities(): HostCapabilities;
}
