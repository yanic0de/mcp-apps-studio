import { describe, expect, it } from 'vitest';
import { formatZodIssues } from './json-rpc.js';
import { mockConfigSchema, toolMockSchema } from './mocks.js';

describe('toolMockSchema', () => {
  it('accepts the three mock kinds', () => {
    expect(toolMockSchema.parse({ kind: 'static', result: { n: 1 }, delayMs: 10 })).toEqual({
      kind: 'static',
      result: { n: 1 },
      delayMs: 10,
    });
    expect(toolMockSchema.parse({ kind: 'error', error: { code: -32000, message: 'down' } })).toMatchObject({
      kind: 'error',
    });
    expect(toolMockSchema.parse({ kind: 'passthrough' })).toEqual({ kind: 'passthrough' });
  });

  it('keeps a static result of null/undefined as given', () => {
    expect(toolMockSchema.parse({ kind: 'static', result: null })).toEqual({ kind: 'static', result: null });
  });

  it('rejects a misspelled kind, naming the field', () => {
    const r = toolMockSchema.safeParse({ kind: 'statik', result: 1 });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodIssues(r.error)).toMatch(/kind/);
  });

  it('rejects a negative or fractional delay and a non-string error message', () => {
    expect(toolMockSchema.safeParse({ kind: 'static', result: 1, delayMs: -5 }).success).toBe(false);
    expect(toolMockSchema.safeParse({ kind: 'static', result: 1, delayMs: 1.5 }).success).toBe(false);
    expect(toolMockSchema.safeParse({ kind: 'error', error: { code: 1, message: 42 } }).success).toBe(false);
  });
});

describe('mockConfigSchema', () => {
  it('validates each tool entry and reports the tool name in the path', () => {
    const r = mockConfigSchema.safeParse({ ok: { kind: 'passthrough' }, bad: { kind: 'error', error: {} } });
    expect(r.success).toBe(false);
    if (!r.success) expect(formatZodIssues(r.error)).toMatch(/bad\.error\./);
  });
});
