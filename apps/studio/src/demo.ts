import type { WidgetManifestEntry } from '@studio/shared';
import widgetHtml from './demo/kpi-widget.html?raw';

/** Built-in fallback widget: used when no CLI manifest is served (plain `vite dev`). */
export const demoWidget: WidgetManifestEntry = {
  id: 'demo-kpi',
  title: 'KPI Card (demo)',
  html: widgetHtml,
  scenarios: {
    default: {
      mocks: {
        get_metrics: { kind: 'static', result: { value: 12840, delta: 8.3, label: 'Monthly active users' } },
      },
    },
    loading: {
      mocks: {
        get_metrics: {
          kind: 'static',
          result: { value: 12840, delta: 8.3, label: 'Monthly active users' },
          delayMs: 3_600_000,
        },
      },
    },
    error: {
      mocks: {
        get_metrics: { kind: 'error', error: { code: -32000, message: 'Metrics backend unavailable' } },
      },
    },
    // Live: no mocks — every tool call is proxied to the example server (passthrough).
    live: { mocks: {} },
  },
};
