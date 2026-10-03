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
    // Played by `mcp-apps-studio test`: the card fetches on mount, then once more per Refresh click.
    refresh: {
      mocks: {
        get_metrics: { kind: 'static', structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' } },
      },
      steps: [
        { expectToolCall: { name: 'get_metrics' } },
        { click: 'button.kpi-card__refresh' },
        { expectToolCall: { name: 'get_metrics' } },
      ],
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
