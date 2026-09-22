## ADDED Requirements

### Requirement: Reference widget renders the tool result
`kpi-card.html` SHALL render the metrics from the `structuredContent` of `ui/notifications/tool-result`, show the text of an `isError` result as its error state, show a cancellation reason from `tool-cancelled`, and keep the Refresh button calling `get_metrics` via `tools/call`. It MUST NOT call the tool on load.

#### Scenario: Result pushed by the host
- **WHEN** the host sends `tool-result` with `structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' }`
- **THEN** the value shows `12,840`
