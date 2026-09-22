import type { CallToolResult } from '@modelcontextprotocol/client';
import { toolResultData } from './tool-result.js';

export type ToolLifecycleEvent =
  | { type: 'input-partial'; arguments: Record<string, unknown> }
  | { type: 'input'; arguments: Record<string, unknown> }
  | { type: 'result'; result: CallToolResult }
  | { type: 'cancelled'; reason?: string };

export interface ToolLifecycleState<T> {
  status: 'waiting' | 'streaming' | 'input' | 'result' | 'error' | 'cancelled';
  input: Record<string, unknown> | null;
  data: T | null;
  error: string | null;
  reason: string | null;
}

export const initialToolLifecycle: ToolLifecycleState<never> = {
  status: 'waiting',
  input: null,
  data: null,
  error: null,
  reason: null,
};

/** Pure state machine over the host's tool-input(-partial) → tool-result | tool-cancelled notifications. */
export function reduceToolLifecycle<T>(state: ToolLifecycleState<T>, ev: ToolLifecycleEvent): ToolLifecycleState<T> {
  switch (ev.type) {
    case 'input-partial':
      return { ...state, status: 'streaming', input: ev.arguments };
    case 'input':
      return { ...state, status: 'input', input: ev.arguments };
    case 'result':
      try {
        return { ...state, status: 'result', data: toolResultData<T>(ev.result), error: null };
      } catch (e) {
        return { ...state, status: 'error', error: (e as Error).message };
      }
    case 'cancelled':
      return { ...state, status: 'cancelled', reason: ev.reason ?? null };
  }
}
