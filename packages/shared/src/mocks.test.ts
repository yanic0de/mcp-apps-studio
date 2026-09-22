import { describe, expect, it } from 'vitest';
import { formatZodIssues } from './json-rpc.js';
import { mockConfigSchema, toolMockSchema } from './mocks.js';

describe('toolMockSchema', () => {
  it('accepts the four mock kinds', () => {
    expect(toolMockSchema.parse({ kind: 'static', structuredContent: { n: 1 }, delayMs: 10 })).toEqual({
      kind: 'static',
      structuredContent: { n: 1 },
      delayMs: 10,
    });
    expect(toolMockSchema.parse({ kind: 'static', content: [{ type: 'text', text: 'hi' }] })).toMatchObject({
      kind: 'static',
    });
    expect(toolMockSchema.parse({ kind: 'error', message: 'down' })).toEqual({ kind: 'error', message: 'down' });
    expect(toolMockSchema.parse({ kind: 'rpc-error', error: { code: -32000, message: 'down' } })).toMatchObject({
      kind: 'rpc-error',
    });
    expect(toolMockSchema.parse({ kind: 'passthrough' })).toEqual({ kind: 'passthrough' });
  });

  it('rejects null structured content: MCP structured content is an object', () => {
    expect(toolMockSchema.safeParse({ kind: 'static', structuredContent: null }).success).toBe(false);
  });

  it('rejects the pre-CallToolResult `result` field so stale stories fail loudly', () => {
    const r = toolMockSchema.safeParse({ kind: 'static', result: { v: 1 } });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodIssues(r.error)).toMatch(/result/);
  });

  it('rejects a misspelled kind, naming the field', () => {
    const r = toolMockSchema.safeParse({ kind: 'statik', structuredContent: {} });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodIssues(r.error)).toMatch(/kind/);
  });

  it('rejects a negative or fractional delay and a non-string error message', () => {
    expect(toolMockSchema.safeParse({ kind: 'static', delayMs: -5 }).success).toBe(false);
    expect(toolMockSchema.safeParse({ kind: 'static', delayMs: 1.5 }).success).toBe(false);
    expect(toolMockSchema.safeParse({ kind: 'error', message: 42 }).success).toBe(false);
    expect(toolMockSchema.safeParse({ kind: 'rpc-error', error: { code: 1, message: 42 } }).success).toBe(false);
  });
});

describe('mockConfigSchema', () => {
  it('validates each tool entry and reports the tool name in the path', () => {
    const r = mockConfigSchema.safeParse({ ok: { kind: 'passthrough' }, bad: { kind: 'rpc-error', error: {} } });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodIssues(r.error)).toMatch(/bad\.error\./);
  });
});
