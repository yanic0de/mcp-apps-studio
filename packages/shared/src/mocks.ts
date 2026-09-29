import { z } from 'zod';
import { contentBlockSchema } from './protocol.js';

const delayMs = z.number().int().nonnegative().optional();
const recordSchema = z.record(z.string(), z.unknown());

// Strict objects: a stale field (e.g. the pre-CallToolResult `result`) must fail discovery, not render nothing.

/** Success result; `content` defaults to a JSON text block of `structuredContent`. */
const staticMock = z.strictObject({
  kind: z.literal('static'),
  structuredContent: recordSchema.optional(),
  content: z.array(contentBlockSchema).optional(),
  delayMs,
});
/** Tool failure as servers report it: `isError: true` with the message as text content. */
const errorMock = z.strictObject({ kind: z.literal('error'), message: z.string(), delayMs });
/** Protocol-level failure: a JSON-RPC error instead of a result. */
const rpcErrorMock = z.strictObject({
  kind: z.literal('rpc-error'),
  error: z.object({ code: z.number().int(), message: z.string() }),
  delayMs,
});
const passthroughMock = z.strictObject({ kind: z.literal('passthrough') });
const cancelledResult = z.strictObject({ kind: z.literal('cancelled'), reason: z.string().optional(), delayMs });

/** How the emulator answers a `tools/call` for one tool. Single source for the type AND runtime validation. */
export const toolMockSchema = z.discriminatedUnion('kind', [staticMock, errorMock, rpcErrorMock, passthroughMock]);
export type ToolMock = z.infer<typeof toolMockSchema>;

/** tool name → mock */
export const mockConfigSchema = z.record(z.string(), toolMockSchema);
export type MockConfig = z.infer<typeof mockConfigSchema>;

/** Result of the model's tool call that rendered the widget: no JSON-RPC channel here, so cancellation instead of rpc-error. */
export const toolCallResultSchema = z.discriminatedUnion('kind', [
  staticMock,
  errorMock,
  passthroughMock,
  cancelledResult,
]);
export type ToolCallResult = z.infer<typeof toolCallResultSchema>;

/** The tool call that rendered the widget; the host plays it as tool-input(-partial) → tool-result | tool-cancelled. */
export const toolCallSchema = z.strictObject({
  name: z.string().min(1).optional(),
  input: recordSchema.optional(),
  partialInputs: z.array(recordSchema).optional(),
  result: toolCallResultSchema.optional(),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

/** One story scenario: mocks for widget-initiated calls + the originating tool call. */
export const scenarioSchema = z.object({
  mocks: mockConfigSchema.optional(),
  toolCall: toolCallSchema.optional(),
});
export type Scenario = z.infer<typeof scenarioSchema>;
