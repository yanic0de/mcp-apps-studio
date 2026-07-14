import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_CODES } from '@studio/shared';
import { MockRouter } from './mock-router.js';

afterEach(() => vi.useRealTimers());

describe('MockRouter', () => {
  it('returns static mock result', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'static', result: { rows: [1] } } });
    await expect(router.call('get_metrics', {})).resolves.toEqual({ rows: [1] });
  });

  it('throws RpcError for error mock', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'error', error: { code: -32000, message: 'boom' } } });
    await expect(router.call('get_metrics', {})).rejects.toMatchObject({ code: -32000, message: 'boom' });
  });

  it('applies delayMs before resolving', async () => {
    vi.useFakeTimers();
    const router = new MockRouter({ slow: { kind: 'static', result: 'done', delayMs: 500 } });
    const p = router.call('slow', {});
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await expect(p).resolves.toBe('done');
  });

  it('routes passthrough kind and unmocked tools to passthrough handler', async () => {
    const passthrough = vi.fn().mockResolvedValue('real');
    const router = new MockRouter({ proxied: { kind: 'passthrough' } }, passthrough);
    await expect(router.call('proxied', { a: 1 })).resolves.toBe('real');
    await expect(router.call('unmocked', {})).resolves.toBe('real');
    expect(passthrough).toHaveBeenCalledWith('proxied', { a: 1 });
  });

  it('throws METHOD_NOT_FOUND when no mock and no passthrough', async () => {
    const router = new MockRouter({});
    await expect(router.call('ghost', {})).rejects.toMatchObject({ code: ERROR_CODES.METHOD_NOT_FOUND });
  });

  it('setConfig replaces mocks', async () => {
    const router = new MockRouter({});
    router.setConfig({ t: { kind: 'static', result: 1 } });
    await expect(router.call('t', {})).resolves.toBe(1);
  });
});
