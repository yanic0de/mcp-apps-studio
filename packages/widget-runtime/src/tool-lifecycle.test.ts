import { describe, expect, it } from 'vitest';
import { initialToolLifecycle, reduceToolLifecycle, type ToolLifecycleState } from './tool-lifecycle.js';

const run = (...events: Parameters<typeof reduceToolLifecycle>[1][]) =>
  events.reduce<ToolLifecycleState<unknown>>(reduceToolLifecycle, initialToolLifecycle);

describe('reduceToolLifecycle', () => {
  it('starts waiting', () => {
    expect(initialToolLifecycle).toEqual({ status: 'waiting', input: null, data: null, error: null, reason: null });
  });

  it('streams, then takes the input, then the structured result', () => {
    expect(run({ type: 'input-partial', arguments: { q: 'a' } })).toMatchObject({
      status: 'streaming',
      input: { q: 'a' },
    });
    expect(
      run(
        { type: 'input-partial', arguments: { q: 'a' } },
        { type: 'input', arguments: { q: 'ab' } },
        { type: 'result', result: { content: [], structuredContent: { v: 1 } } },
      ),
    ).toEqual({ status: 'result', input: { q: 'ab' }, data: { v: 1 }, error: null, reason: null });
  });

  it('turns an isError result into error text', () => {
    expect(
      run(
        { type: 'input', arguments: {} },
        { type: 'result', result: { isError: true, content: [{ type: 'text', text: 'db down' }] } },
      ),
    ).toMatchObject({ status: 'error', error: 'db down', data: null });
  });

  it('records a cancellation reason', () => {
    expect(run({ type: 'input', arguments: {} }, { type: 'cancelled', reason: 'user' })).toMatchObject({
      status: 'cancelled',
      reason: 'user',
    });
  });
});
