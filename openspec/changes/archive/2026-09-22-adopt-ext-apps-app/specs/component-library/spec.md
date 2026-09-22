## MODIFIED Requirements

### Requirement: Widget entry point
A component's entry SHALL call `connectWidget({ appInfo })` from `@studio/widget-runtime` (theme, variables and fonts are applied and size is reported by the SDK's auto-resize), then mount the component inside `WidgetProvider` with the returned session.

#### Scenario: Loading in the studio
- **WHEN** the iframe with the bundled component loads
- **THEN** `ui/initialize`, `ui/notifications/initialized`, `tools/call` and `size-changed` from the widget appear in the trace
