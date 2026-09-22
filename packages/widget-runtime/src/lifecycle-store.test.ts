import { App } from '@modelcontextprotocol/ext-apps';
import { describe, expect, it } from 'vitest';
import { createToolLifecycleStore } from './lifecycle-store.js';
import { emulatorHost, flush } from './test-host.js';

describe('createToolLifecycleStore', () => {
  it('follows input → result and notifies subscribers until they unsubscribe', async () => {
    const { transport } = emulatorHost({
      toolCall: {
        name: 't',
        input: { q: 'ab' },
        partialInputs: [{ q: 'a' }],
        result: { kind: 'error', message: 'db down' },
      },
    });
    const app = new App({ name: 'w', version: '1' }, {}, { autoResize: false });
    const store = createToolLifecycleStore(app);
    const statuses: string[] = [];
    const off = store.subscribe(() => statuses.push(store.getSnapshot().status));
    await app.connect(transport);
    await flush();
    expect(statuses).toEqual(['streaming', 'input', 'error']);
    expect(store.getSnapshot()).toMatchObject({ input: { q: 'ab' }, error: 'db down' });
    off();
    expect(statuses).toHaveLength(3);
  });

  it('starts waiting', () => {
    const store = createToolLifecycleStore(new App({ name: 'w', version: '1' }, {}, { autoResize: false }));
    expect(store.getSnapshot().status).toBe('waiting');
  });

  it('records a cancellation', async () => {
    const { transport } = emulatorHost({ toolCall: { name: 't', result: { kind: 'cancelled', reason: 'user' } } });
    const app = new App({ name: 'w', version: '1' }, {}, { autoResize: false });
    const store = createToolLifecycleStore(app);
    await app.connect(transport);
    await flush();
    expect(store.getSnapshot()).toMatchObject({ status: 'cancelled', reason: 'user' });
  });
});
