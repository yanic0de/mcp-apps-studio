import { describe, expect, it } from 'vitest';
import { toolResultData } from './tool-result.js';

describe('toolResultData', () => {
  it('returns structured content', () => {
    expect(toolResultData({ content: [], structuredContent: { v: 1 } })).toEqual({ v: 1 });
  });

  it('returns null when the tool gave no structured content', () => {
    expect(toolResultData({ content: [{ type: 'text', text: 'hi' }] })).toBeNull();
  });

  it('throws the text content of an isError result', () => {
    expect(() =>
      toolResultData({
        isError: true,
        content: [
          { type: 'text', text: 'db' },
          { type: 'text', text: 'down' },
        ],
      }),
    ).toThrow('db down');
  });

  it('falls back to a generic message for an isError result without text', () => {
    expect(() => toolResultData({ isError: true, content: [] })).toThrow('tool call failed');
  });
});
