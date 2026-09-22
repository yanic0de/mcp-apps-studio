## ADDED Requirements

### Requirement: Reference widget follows the SDK handshake
`kpi-card.html` SHALL send `ui/initialize` with `appInfo`, `appCapabilities` and `protocolVersion`, then `ui/notifications/initialized`, and SHALL read tool data from `structuredContent` of the `CallToolResult`, showing the text content of an `isError` result as its error state.

#### Scenario: Handshake in the studio
- **WHEN** the widget loads in the studio
- **THEN** the trace contains `ui/notifications/initialized` and no `invalid` events

#### Scenario: Tool error result
- **WHEN** `get_metrics` answers `isError: true` with `Metrics backend unavailable`
- **THEN** the status shows that text with the error class
