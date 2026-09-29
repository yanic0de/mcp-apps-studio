import { ERROR_CODES } from '@studio/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockRouter } from './mock-router.js';

afterEach(() => vi.useRealTimers());

describe('MockRouter', () => {
  it('returns a CallToolResult with a JSON text fallback for structured content', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'static', structuredContent: { v: 1 } } });
    await expect(router.call('get_metrics', {})).resolves.toEqual({
      content: [{ type: 'text', text: '{"v":1}' }],
      structuredContent: { v: 1 },
    });
  });

  it('keeps explicit content and allows an empty static result', async () => {
    const router = new MockRouter({
      text: { kind: 'static', content: [{ type: 'text', text: 'hi' }] },
      empty: { kind: 'static' },
    });
    await expect(router.call('text', {})).resolves.toEqual({ content: [{ type: 'text', text: 'hi' }] });
    await expect(router.call('empty', {})).resolves.toEqual({ content: [] });
  });

  it('returns an isError result for an error mock', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'error', message: 'boom' } });
    await expect(router.call('get_metrics', {})).resolves.toEqual({
      isError: true,
      content: [{ type: 'text', text: 'boom' }],
    });
  });

  it('throws RpcError for an rpc-error mock', async () => {
    const router = new MockRouter({ get_metrics: { kind: 'rpc-error', error: { code: -32601, message: 'nope' } } });
    await expect(router.call('get_metrics', {})).rejects.toMatchObject({ code: -32601, message: 'nope' });
  });

  it('applies delayMs before resolving', async () => {
    vi.useFakeTimers();
    const router = new MockRouter({ slow: { kind: 'static', structuredContent: { done: true }, delayMs: 500 } });
    const p = router.call('slow', {});
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await expect(p).resolves.toMatchObject({ structuredContent: { done: true } });
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
    router.setConfig({ t: { kind: 'static', structuredContent: { n: 1 } } });
    await expect(router.call('t', {})).resolves.toMatchObject({ structuredContent: { n: 1 } });
  });
});
