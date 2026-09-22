export default {
  title: 'KPI Card',
  widget: '../../dist/kpi-card.html',
  scenarios: {
    default: {
      // The model's call that rendered the widget (tool-input + toolInfo); the component fetches its own data.
      toolCall: { name: 'get_metrics' },
      mocks: {
        get_metrics: { kind: 'static', structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' } },
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
  },
};
