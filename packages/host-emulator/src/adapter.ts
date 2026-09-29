import type {
  CallToolResult,
  ContentBlock,
  HostContext,
  JsonRpcNotification,
  JsonRpcRequest,
  WidgetSource,
} from '@studio/shared';

export type AdapterId = 'mcp-apps' | 'openai-apps' | 'mcp-ui-legacy';

export interface IframeEnv {
  mode: 'srcdoc' | 'src';
  content: string;
  sandbox: string[];
  csp?: string;
}

/** Things a widget asks the host to do on its behalf; the embedder decides how to show them. */
export type WidgetIntent =
  | { type: 'open-link'; url: string }
  | { type: 'message'; role: 'user'; content: ContentBlock[] }
  | { type: 'update-model-context'; content?: ContentBlock[]; structuredContent?: Record<string, unknown> }
  | { type: 'download-file'; contents: Record<string, unknown>[] }
  | { type: 'log'; level: string; logger?: string; data: unknown }
  | { type: 'request-teardown' };

/**
 * Semantic meaning of a widget message. Request ids stay with the bridge
 * (it answers using the original request), so actions carry none.
 */
export type AdapterAction =
  | { type: 'initialize' }
  | { type: 'initialized' }
  | { type: 'tool-call'; toolName: string; args: unknown }
  | { type: 'resource-read'; uri: string }
  | { type: 'size-changed'; width?: number; height?: number }
  | { type: 'request-display-mode'; mode: HostContext['displayMode'] }
  | WidgetIntent
  | { type: 'invalid-params'; method: string; error: string }
  | { type: 'unsupported'; method: string };

export type HostEvent =
  | { type: 'context-changed'; context: Partial<HostContext> }
  | { type: 'tool-input-partial'; arguments: Record<string, unknown> }
  | { type: 'tool-input'; arguments: Record<string, unknown> }
  | { type: 'tool-result'; result: CallToolResult }
  | { type: 'tool-cancelled'; reason?: string };

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
