import {
  callToolResultSchema,
  jsonRpcErrorObjectSchema,
  MCP_APPS_METHODS,
  type MockConfig,
  type RpcLogEvent,
  type Scenario,
  scenarioSchema,
  type ToolCall,
  type ToolCallResult,
  toolsCallParamsSchema,
} from '@studio/shared';

type Payload = { params?: unknown; result?: unknown; error?: unknown };

const payloadOf = (ev: RpcLogEvent) => (ev.payload ?? {}) as Payload;

const errorText = (content: { type: string; text?: unknown }[]) =>
  content
    .map((b) => (b.type === 'text' && typeof b.text === 'string' ? b.text : ''))
    .filter(Boolean)
    .join(' ') || 'tool call failed';

/** A recorded CallToolResult as the mock that reproduces it. */
function resultMock(raw: unknown): Extract<ToolCallResult, { kind: 'static' | 'error' }> | null {
  const parsed = callToolResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (r.isError) return { kind: 'error', message: errorText(r.content) };
  return {
    kind: 'static',
    content: r.content,
    ...(r.structuredContent ? { structuredContent: r.structuredContent } : {}),
  };
}

/**
 * Turns a (live) trace into a scenario: answered widget tools/call → mocks (last answer per tool wins),
 * pushed tool-input/tool-result|tool-cancelled → the originating toolCall.
 */
export function recordScenario(log: RpcLogEvent[], toolName?: string): Scenario {
  const pending = new Map<string, string>(); // request id → tool name
  const mocks: MockConfig = {};
  let toolCall: ToolCall | undefined;

  for (const ev of log) {
    const p = payloadOf(ev);
    if (ev.direction === 'widget→host' && ev.kind === 'request' && ev.method === MCP_APPS_METHODS.toolsCall) {
      const params = toolsCallParamsSchema.safeParse(p.params);
      if (params.success && ev.id !== undefined) pending.set(String(ev.id), params.data.name);
      continue;
    }
    if (ev.direction === 'host→widget' && ev.kind === 'response' && ev.id !== undefined) {
      const name = pending.get(String(ev.id));
      if (!name) continue;
      pending.delete(String(ev.id));
      const rpcError = jsonRpcErrorObjectSchema.safeParse(p.error);
      if (rpcError.success) {
        mocks[name] = { kind: 'rpc-error', error: { code: rpcError.data.code, message: rpcError.data.message } };
        continue;
      }
      const mock = resultMock(p.result);
      if (mock) mocks[name] = mock;
      continue;
    }
    if (ev.direction !== 'host→widget' || ev.kind !== 'notification') continue;
    const params = (p.params ?? {}) as Record<string, unknown>;
    switch (ev.method) {
      case MCP_APPS_METHODS.toolInput:
        toolCall = {
          ...(toolName ? { name: toolName } : {}),
          input: (params.arguments as Record<string, unknown> | undefined) ?? {},
        };
        break;
      case MCP_APPS_METHODS.toolResult: {
        const result = resultMock(params);
        if (toolCall && result) toolCall.result = result;
        break;
      }
      case MCP_APPS_METHODS.toolCancelled:
        if (toolCall) {
          toolCall.result = {
            kind: 'cancelled',
            ...(typeof params.reason === 'string' ? { reason: params.reason } : {}),
          };
        }
        break;
    }
  }

  // Same schema the CLI validates stories with: a recording can never produce an unloadable scenario.
  return scenarioSchema.parse({ mocks, ...(toolCall ? { toolCall } : {}) });
}

/** Paste-ready entry for the `scenarios` object of a *.stories.mcp.ts file. */
export function scenarioSnippet(name: string, scenario: Scenario): string {
  return `${JSON.stringify(name)}: ${JSON.stringify(scenario, null, 2)},`;
}
