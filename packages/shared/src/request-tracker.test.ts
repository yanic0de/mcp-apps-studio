import { describe, expect, it, vi } from 'vitest';
import { RpcError } from './errors.js';
import { ERROR_CODES } from './json-rpc.js';
import { RequestTracker } from './request-tracker.js';

const make = (timeoutMs = 1000) => new RequestTracker({ idPrefix: 't', timeoutMs });

describe('RequestTracker', () => {
  it('allocates prefixed sequential ids', () => {
    const tracker = make();
    expect(tracker.track('a').id).toBe('t1');
    expect(tracker.track('b').id).toBe('t2');
    expect(tracker.size).toBe(2);
  });

  it('resolves a tracked request from a result response', async () => {
    const tracker = make();
    const { id, promise } = tracker.track('ping');
    expect(tracker.settle({ jsonrpc: '2.0', id, result: 'pong' })).toBe(true);
    await expect(promise).resolves.toBe('pong');
    expect(tracker.size).toBe(0);
  });

  it('rejects a tracked request with RpcError (code, message, data) from an error response', async () => {
    const tracker = make();
    const { id, promise } = tracker.track('ping');
    tracker.settle({ jsonrpc: '2.0', id, error: { code: -32000, message: 'boom', data: { why: 1 } } });
    await expect(promise).rejects.toMatchObject({ code: -32000, message: 'boom', data: { why: 1 } });
    await expect(promise).rejects.toBeInstanceOf(RpcError);
  });

  it('reports unknown and null ids without touching pending requests', () => {
    const tracker = make();
    tracker.track('ping');
    expect(tracker.settle({ jsonrpc: '2.0', id: 'nope', result: 1 })).toBe(false);
    expect(tracker.settle({ jsonrpc: '2.0', id: null, error: { code: 1, message: 'x' } })).toBe(false);
    expect(tracker.size).toBe(1);
  });

  it('times out with REQUEST_TIMEOUT and forgets the request', async () => {
    vi.useFakeTimers();
    try {
      const tracker = make(500);
      const { promise } = tracker.track('slow');
      const assertion = expect(promise).rejects.toMatchObject({ code: ERROR_CODES.REQUEST_TIMEOUT });
      await vi.advanceTimersByTimeAsync(501);
      await assertion;
      expect(tracker.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not time out a request that already settled', async () => {
    vi.useFakeTimers();
    try {
      const tracker = make(500);
      const { id, promise } = tracker.track('fast');
      tracker.settle({ jsonrpc: '2.0', id, result: 'ok' });
      vi.advanceTimersByTime(5000);
      await expect(promise).resolves.toBe('ok');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reject() fails one request locally', async () => {
    const tracker = make();
    const { id, promise } = tracker.track('x');
    expect(tracker.reject(id, new Error('send failed'))).toBe(true);
    await expect(promise).rejects.toThrow('send failed');
    expect(tracker.reject(id, new Error('again'))).toBe(false);
  });

  it('rejectAll() fails every pending request and clears timers', async () => {
    vi.useFakeTimers();
    try {
      const tracker = make();
      const a = tracker.track('a').promise;
      const b = tracker.track('b').promise;
      const assertions = Promise.all([expect(a).rejects.toThrow('stopped'), expect(b).rejects.toThrow('stopped')]);
      tracker.rejectAll(new Error('stopped'));
      await assertions;
      expect(tracker.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
