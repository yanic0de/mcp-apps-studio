import { describe, expect, it } from 'vitest';
import { createToolCaller, type ToolCallSnapshot } from './tool-caller.js';

function harness<T>() {
  let state: ToolCallSnapshot<T> = { data: null, error: null, loading: false };
  const setState = (updater: (prev: ToolCallSnapshot<T>) => ToolCallSnapshot<T>) => {
    state = updater(state);
  };
  return { setState, get: () => state };
}

describe('createToolCaller', () => {
  it('goes loading → data on success', async () => {
    const h = harness<string>();
    const call = createToolCaller(async () => 'ok', h.setState);
    const p = call();
    expect(h.get()).toMatchObject({ loading: true, error: null });
    await p;
    expect(h.get()).toEqual({ data: 'ok', error: null, loading: false });
  });

  it('keeps previous data and sets error message on failure', async () => {
    const h = harness<string>();
    let fail = false;
    const call = createToolCaller(async () => {
      if (fail) throw new Error('boom');
      return 'ok';
    }, h.setState);
    await call();
    fail = true;
    await call();
    expect(h.get()).toEqual({ data: 'ok', error: 'boom', loading: false });
  });

  it('ignores a stale response that settles after a newer call', async () => {
    const h = harness<string>();
    const resolvers: Array<(v: string) => void> = [];
    const call = createToolCaller(
      () => new Promise<string>((resolve) => resolvers.push(resolve)),
      h.setState,
    );
    const first = call();
    const second = call();
    resolvers[1]?.('fresh');
    await second;
    resolvers[0]?.('stale');
    await first;
    expect(h.get()).toEqual({ data: 'fresh', error: null, loading: false });
  });

  it('ignores a stale error that settles after a newer call', async () => {
    const h = harness<string>();
    const settlers: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];
    const call = createToolCaller(
      () => new Promise<string>((resolve, reject) => settlers.push({ resolve, reject })),
      h.setState,
    );
    const first = call();
    const second = call();
    settlers[1]?.resolve('fresh');
    await second;
    settlers[0]?.reject(new Error('stale failure'));
    await first;
    expect(h.get()).toEqual({ data: 'fresh', error: null, loading: false });
  });
});
