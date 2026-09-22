// Single source: the reference vanilla widget shipped by the example server.
import widgetHtml from '@studio/example-server/kpi-card.html?raw';
import type { WidgetManifestEntry } from '@studio/shared';

/** Built-in fallback widget: used when no CLI manifest is served (plain `vite dev`). */
export const demoWidget: WidgetManifestEntry = {
  id: 'demo-kpi',
  title: 'KPI Card (demo)',
  html: widgetHtml,
  scenarios: {
    default: {
      mocks: {
        get_metrics: {
          kind: 'static',
          structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' },
        },
      },
    },
    loading: {
      mocks: {
        get_metrics: {
          kind: 'static',
          structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' },
          delayMs: 3_600_000,
        },
      },
    },
    error: {
      mocks: {
        get_metrics: { kind: 'error', message: 'Metrics backend unavailable' },
      },
    },
    // Live: no mocks — every tool call is proxied to the example server (passthrough).
    live: { mocks: {} },
  },
};
