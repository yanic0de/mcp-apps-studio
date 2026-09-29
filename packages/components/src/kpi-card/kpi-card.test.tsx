import { App, createToolLifecycleStore } from '@mcp-apps-studio/widget-runtime';
import { WidgetProvider } from '@mcp-apps-studio/widget-runtime/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { kpiCardTextFallback } from './fallback.js';
import { KpiCard } from './KpiCard.js';

// Not connected: server rendering only needs the session shape.
const app = new App({ name: 'test', version: '0' }, {}, { autoResize: false });
const session = { app, lifecycle: createToolLifecycleStore(app) };

describe('KpiCard', () => {
  it('renders title and placeholder before data arrives', () => {
    const html = renderToString(
      <WidgetProvider session={session}>
        <KpiCard title="Revenue" />
      </WidgetProvider>,
    );
    expect(html).toContain('Revenue');
    expect(html).toContain('—');
    expect(html).toContain('kpi-card');
  });
});

describe('kpiCardTextFallback', () => {
  it('formats positive and negative deltas', () => {
    expect(kpiCardTextFallback({ value: 12840, delta: 8.3, label: 'MAU' })).toBe('MAU: 12840 (+8.3%)');
    expect(kpiCardTextFallback({ value: 100, delta: -2, label: 'Err' })).toBe('Err: 100 (-2%)');
  });
});
