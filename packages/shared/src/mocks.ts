import { z } from 'zod';
import { contentBlockSchema } from './protocol.js';

const delayMs = z.number().int().nonnegative().optional();

/**
 * How the emulator answers a `tools/call` for one tool. Single source for the type AND runtime validation.
 * Strict objects: a stale field (e.g. the pre-CallToolResult `result`) must fail discovery, not render nothing.
 */
export const toolMockSchema = z.discriminatedUnion('kind', [
  /** Success result; `content` defaults to a JSON text block of `structuredContent`. */
  z.strictObject({
    kind: z.literal('static'),
    structuredContent: z.record(z.string(), z.unknown()).optional(),
    content: z.array(contentBlockSchema).optional(),
    delayMs,
  }),
  /** Tool failure as servers report it: `isError: true` with the message as text content. */
  z.strictObject({ kind: z.literal('error'), message: z.string(), delayMs }),
  /** Protocol-level failure: a JSON-RPC error instead of a result. */
  z.strictObject({
    kind: z.literal('rpc-error'),
    error: z.object({ code: z.number().int(), message: z.string() }),
    delayMs,
  }),
  z.strictObject({ kind: z.literal('passthrough') }),
]);
export type ToolMock = z.infer<typeof toolMockSchema>;

/** tool name → mock */
export const mockConfigSchema = z.record(z.string(), toolMockSchema);
export type MockConfig = z.infer<typeof mockConfigSchema>;
