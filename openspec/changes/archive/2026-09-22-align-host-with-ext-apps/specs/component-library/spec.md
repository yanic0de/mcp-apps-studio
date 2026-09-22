## MODIFIED Requirements

### Requirement: KPI Card
`KpiCard` SHALL call a tool on mount (default `get_metrics`), show `structuredContent.value` via `toLocaleString`, a caption with `label` and the direction of `delta`, a `loading…` state, the error text, and a `Refresh` button with `type="button"`.

#### Scenario: Data received
- **WHEN** the tool returns `structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' }`
- **THEN** the value renders as `12,840` and the status contains `Monthly active users ▲8.3%`

#### Scenario: Tool error
- **WHEN** the tool returns `isError: true` with the text `Metrics backend unavailable`
- **THEN** the status contains that message and the error class
