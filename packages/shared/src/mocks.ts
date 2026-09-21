import { z } from 'zod';

const delayMs = z.number().int().nonnegative().optional();

/** How the emulator answers a `tools/call` for one tool. Single source for the type AND runtime validation. */
export const toolMockSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('static'), result: z.unknown(), delayMs }),
  z.object({
    kind: z.literal('error'),
    error: z.object({ code: z.number().int(), message: z.string() }),
    delayMs,
  }),
  z.object({ kind: z.literal('passthrough') }),
]);
export type ToolMock = z.infer<typeof toolMockSchema>;

/** tool name → mock */
export const mockConfigSchema = z.record(z.string(), toolMockSchema);
export type MockConfig = z.infer<typeof mockConfigSchema>;
