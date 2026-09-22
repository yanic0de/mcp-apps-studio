import { App } from '@modelcontextprotocol/ext-apps';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createToolLifecycleStore } from './lifecycle-store.js';
import { useToolLifecycle, useWidgetApp, WidgetProvider } from './react.js';

function ShowApp() {
  useWidgetApp();
  return <span>ok</span>;
}

function ShowStatus() {
  return <span>{useToolLifecycle().status}</span>;
}

describe('react wrappers', () => {
  it('useWidgetApp throws outside the provider', () => {
    expect(() => renderToString(<ShowApp />)).toThrow(/<WidgetProvider>/);
  });

  it('useToolLifecycle reads the session store', () => {
    const app = new App({ name: 'w', version: '1' }, {}, { autoResize: false });
    const html = renderToString(
      <WidgetProvider session={{ app, lifecycle: createToolLifecycleStore(app) }}>
        <ShowStatus />
      </WidgetProvider>,
    );
    expect(html).toContain('waiting');
  });
});
