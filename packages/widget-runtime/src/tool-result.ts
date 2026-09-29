import type { CallToolResult } from '@modelcontextprotocol/client';

/**
 * Unwraps a `CallToolResult` for UI code: `structuredContent` (or null) on success;
 * an `isError` result throws its text content, so callers handle one error path.
 */
export function toolResultData<T>(result: CallToolResult): T | null {
  if (result.isError) {
    const text = result.content
      .map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
      .filter(Boolean)
      .join(' ');
    throw new Error(text || 'tool call failed');
  }
  return (result.structuredContent as T | undefined) ?? null;
}
