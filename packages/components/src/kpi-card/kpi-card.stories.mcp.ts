export default {
  title: 'KPI Card',
  widget: '../../dist/kpi-card.html',
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
  },
};
