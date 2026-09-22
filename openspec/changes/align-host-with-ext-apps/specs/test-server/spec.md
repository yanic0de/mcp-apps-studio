## MODIFIED Requirements

### Requirement: Inspector widget
The resource `ui://test/inspector.html` (MIME `text/html;profile=mcp-app`) SHALL contain a button per tool and print the raw request and the raw `CallToolResult`; a result with `isError: true` or a JSON-RPC error SHALL be highlighted with the `error` class. The widget SHALL follow the SDK handshake (`ui/initialize` with `appInfo`, then `ui/notifications/initialized`).

#### Scenario: Use from the studio
- **WHEN** the studio is opened with `?server=http://localhost:3200/mcp` and `live` is selected
- **THEN** the widget heading contains `Protocol Inspector` and the buttons call tools through passthrough

#### Scenario: Tool error shown as a result
- **WHEN** the `fail` button is pressed
- **THEN** the output contains `"isError": true` and `Intentional failure` with the `error` class
