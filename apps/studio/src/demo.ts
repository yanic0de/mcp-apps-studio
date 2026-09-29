// Single source: the reference vanilla widget shipped by the example server.
import widgetHtml from '@studio/example-server/kpi-card.html?raw';
import type { ToolMock, WidgetManifestEntry } from '@studio/shared';

const metrics = {
  kind: 'static',
  structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' },
} as const;
const failure: ToolMock = { kind: 'error', message: 'Metrics backend unavailable' };

/**
 * Built-in fallback widget: used when no CLI manifest is served (plain `vite dev`).
 * `toolCall` is the model's call that rendered the widget (pushed as tool-input → tool-result);
 * `mocks` answer the widget's own calls (the Refresh button).
 */
export const demoWidget: WidgetManifestEntry = {
  id: 'demo-kpi',
  title: 'KPI Card (demo)',
  html: widgetHtml,
  scenarios: {
    default: {
      toolCall: { name: 'get_metrics', result: metrics },
      mocks: { get_metrics: metrics },
    },
    loading: {
      toolCall: { name: 'get_metrics', result: { ...metrics, delayMs: 3_600_000 } },
      mocks: { get_metrics: { ...metrics, delayMs: 3_600_000 } },
    },
    error: {
      toolCall: { name: 'get_metrics', result: failure },
      mocks: { get_metrics: failure },
    },
    cancelled: {
      toolCall: { name: 'get_metrics', result: { kind: 'cancelled', reason: 'user stopped the response' } },
      mocks: { get_metrics: metrics },
    },
    // Live: no mocks — the linked tool is called on the example server and every widget call is proxied.
    live: { mocks: {} },
  },
};
