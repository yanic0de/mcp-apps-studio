import { describe, expect, it, vi } from 'vitest';
import { IframeTransport, type IframeLike, type ListeningWindow } from './iframe-transport.js';

function fakeEnv() {
  const listeners = new Set<(ev: MessageEvent) => void>();
  const win: ListeningWindow = {
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  const contentWindow = { postMessage: vi.fn() };
  const iframe: IframeLike = { contentWindow };
  const emit = (source: unknown, data: unknown) => {
    for (const l of [...listeners]) l({ source, data } as unknown as MessageEvent);
  };
  return { win, iframe, contentWindow, emit, listeners };
}

describe('IframeTransport', () => {
  it('sends via contentWindow.postMessage with wildcard origin', () => {
    const { win, iframe, contentWindow } = fakeEnv();
    new IframeTransport(iframe, win).send({ a: 1 });
    expect(contentWindow.postMessage).toHaveBeenCalledWith({ a: 1 }, '*');
  });

  it('delivers only messages whose source is this iframe contentWindow', () => {
    const { win, iframe, contentWindow, emit } = fakeEnv();
    const t = new IframeTransport(iframe, win);
    const got: unknown[] = [];
    t.onMessage((m) => got.push(m));
    emit(contentWindow, { ok: 1 });
    emit({ postMessage: vi.fn() }, { evil: 1 }); // another window
    emit(null, { evil: 2 });
    expect(got).toEqual([{ ok: 1 }]);
  });

  it('ignores messages when contentWindow is null (iframe unmounted)', () => {
    const listeners = new Set<(ev: MessageEvent) => void>();
    const win: ListeningWindow = {
      addEventListener: (_t, l) => void listeners.add(l),
      removeEventListener: (_t, l) => void listeners.delete(l),
    };
    const iframe: IframeLike = { contentWindow: null };
    const t = new IframeTransport(iframe, win);
    const got: unknown[] = [];
    t.onMessage((m) => got.push(m));
    for (const l of listeners) l({ source: null, data: { x: 1 } } as unknown as MessageEvent);
    expect(got).toEqual([]);
    expect(() => t.send({ a: 1 })).not.toThrow();
  });

  it('unsubscribe and dispose stop delivery', () => {
    const { win, iframe, contentWindow, emit, listeners } = fakeEnv();
    const t = new IframeTransport(iframe, win);
    const got: unknown[] = [];
    const off = t.onMessage((m) => got.push(m));
    off();
    emit(contentWindow, { x: 1 });
    expect(got).toEqual([]);
    t.dispose();
    expect(listeners.size).toBe(0);
  });
});
