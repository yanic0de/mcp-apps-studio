## MODIFIED Requirements

### Requirement: Live scenario
In the `live` scenario the studio SHALL connect to the MCP server at the `?server=` URL (default `http://localhost:3100/mcp`) over streamable HTTP, find the resource by MIME `text/html;profile=mcp-app` (fallback: `ui://` prefix), read its HTML as the widget source, proxy tool calls through passthrough, and find the linked tool (the first tool whose `_meta.ui.resourceUri` equals the resource URI). The studio SHALL then play the model's call: the scenario's `toolCall` with `name` defaulting to the linked tool, `input` to `{}` and `result` to `passthrough`, using the linked tool's definition for `toolInfo`.

#### Scenario: Example server
- **WHEN** the server on :3100 is running and `live` is selected
- **THEN** the widget renders from the server's resource and receives `tool-result` with the data of the server's `get_metrics`

#### Scenario: Another server
- **WHEN** the studio is opened with `?server=http://127.0.0.1:3200/mcp`
- **THEN** live mode shows that server's widget

## ADDED Requirements

### Requirement: Scenario tool call reaches the emulator
Canvas SHALL pass the active scenario's `toolCall` to the emulator, so the lifecycle notifications of every mock scenario appear in the trace after `ui/notifications/initialized`.

#### Scenario: Demo default scenario
- **WHEN** the demo widget loads in the `default` scenario
- **THEN** the trace shows `ui/notifications/tool-input` and `ui/notifications/tool-result` after `ui/notifications/initialized`
