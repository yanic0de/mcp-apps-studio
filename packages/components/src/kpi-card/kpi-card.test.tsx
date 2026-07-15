import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WidgetClient, type WidgetWindow } from '@studio/widget-runtime';
import { WidgetProvider } from '@studio/widget-runtime/react';
import { KpiCard } from './KpiCard.js';
import { kpiCardTextFallback } from './fallback.js';

const fakeWin: WidgetWindow = {
  addEventListener: () => {},
  removeEventListener: () => {},
  parent: { postMessage: () => {} },
};

describe('KpiCard', () => {
  it('renders title and placeholder before data arrives', () => {
    const html = renderToString(
      <WidgetProvider client={new WidgetClient(fakeWin)}>
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
