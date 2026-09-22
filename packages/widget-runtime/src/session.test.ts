import { describe, expect, it } from 'vitest';
import { connectWidget } from './session.js';
import { emulatorHost, flush } from './test-host.js';

const appInfo = { name: 'test-widget', version: '1.0.0' };

describe('connectWidget', () => {
  it('connects the SDK App: host context delivered, host sees initialized', async () => {
    const { emulator, transport } = emulatorHost({
      hostContext: { theme: 'dark', locale: 'de', displayMode: 'inline' },
    });
    const { app } = await connectWidget({ appInfo, transport, autoResize: false, applyToDocument: false });
    await flush();
    expect(app.getHostContext()?.theme).toBe('dark');
    expect(emulator.isReady()).toBe(true);
  });

  it('keeps the merged host context after a change', async () => {
    const { emulator, transport } = emulatorHost({
      hostContext: { theme: 'dark', locale: 'de', displayMode: 'inline' },
    });
    const { app } = await connectWidget({ appInfo, transport, autoResize: false, applyToDocument: false });
    emulator.setHostContext({ theme: 'light' });
    await flush();
    expect(app.getHostContext()).toMatchObject({ theme: 'light', locale: 'de' });
  });

  it('records the tool lifecycle played right after the handshake', async () => {
    const { transport } = emulatorHost({
      toolCall: { name: 't', input: { q: 1 }, result: { kind: 'static', structuredContent: { v: 1 } } },
    });
    const { lifecycle } = await connectWidget({ appInfo, transport, autoResize: false, applyToDocument: false });
    await flush();
    expect(lifecycle.getSnapshot()).toMatchObject({ status: 'result', input: { q: 1 }, data: { v: 1 } });
  });

  it('applies theme, style variables and fonts to the document on connect and on change', async () => {
    const attrs: Record<string, string> = {};
    const vars: Record<string, string> = {};
    const appended: { id: string; textContent: string }[] = [];
    const fakeDocument = {
      documentElement: {
        setAttribute: (k: string, v: string) => {
          attrs[k] = v;
        },
        getAttribute: (k: string) => attrs[k] ?? null,
        classList: { contains: () => false },
        style: {
          setProperty: (k: string, v: string) => {
            vars[k] = v;
          },
          colorScheme: '',
        },
      },
      getElementById: (id: string) => appended.find((e) => e.id === id) ?? null,
      createElement: () => ({ id: '', textContent: '' }),
      head: { appendChild: (el: { id: string; textContent: string }) => void appended.push(el) },
    };
    const g = globalThis as { document?: unknown };
    const previous = g.document;
    g.document = fakeDocument;
    try {
      const { emulator, transport } = emulatorHost({
        hostContext: {
          theme: 'dark',
          locale: 'en',
          displayMode: 'inline',
          styles: { variables: { '--color-background-primary': '#111' }, css: { fonts: '@font-face{}' } },
        },
      });
      await connectWidget({ appInfo, transport, autoResize: false });
      expect(attrs['data-theme']).toBe('dark');
      expect(vars['--color-background-primary']).toBe('#111');
      expect(appended.map((e) => e.textContent)).toEqual(['@font-face{}']);
      emulator.setHostContext({ theme: 'light' });
      await flush();
      expect(attrs['data-theme']).toBe('light');
      emulator.setHostContext({ locale: 'fr' }); // empty patch for the document: nothing breaks
      await flush();
      expect(attrs['data-theme']).toBe('light');
    } finally {
      g.document = previous;
    }
  });
});
