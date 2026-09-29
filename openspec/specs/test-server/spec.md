# Test Polygon (test-server)

## Purpose

`@studio/test-server` is an MCP server where each tool exercises one emulator behavior: data round trip, latency, tool error, pagination, cross-call state. The "Protocol Inspector" widget offers a button per tool and shows the raw JSON of the response. Like example-server, it has no monorepo dependencies.

## Requirements

### Requirement: Tool set
The server SHALL register exactly `echo`, `slow_metrics`, `fail`, `get_rows`, `counter`, each with `_meta.ui.resourceUri` pointing at the inspector resource.

#### Scenario: Tool list
- **WHEN** a client requests `tools/list`
- **THEN** the names equal `['counter', 'echo', 'fail', 'get_rows', 'slow_metrics']`

### Requirement: echo
`echo({ message = 'ping' })` SHALL return `structuredContent: { echoed: args }`.

#### Scenario: Round trip
- **WHEN** called with `{ message: 'hello' }`
- **THEN** `structuredContent` equals `{ echoed: { message: 'hello' } }`

### Requirement: slow_metrics
`slow_metrics({ delayMs = 1500 })` SHALL wait `delayMs` (0…10 000) and return metrics whose `label` mentions the delay.

#### Scenario: Zero delay
- **WHEN** called with `{ delayMs: 0 }`
- **THEN** the response holds a numeric `value` and a string `label`

### Requirement: fail
`fail({ message = 'Intentional failure' })` SHALL return `isError: true` with that text in `content`.

#### Scenario: Tool error reaches the widget
- **WHEN** the inspector presses `fail` in live mode
- **THEN** the widget shows `Intentional failure` in its error state

### Requirement: get_rows
`get_rows({ page = 1, pageSize = 10 })` SHALL return deterministic rows `Row N` out of 42, `columns`, `total: 42`, `page`.

#### Scenario: Second page
- **WHEN** called with `{ page: 2, pageSize: 5 }`
- **THEN** the rows are `Row 6` … `Row 10` and `total === 42`

### Requirement: counter
`counter({ by = 1 })` SHALL increment a module-level value that survives the stateless per-request server instances.

#### Scenario: Two calls over HTTP
- **WHEN** two consecutive `POST /mcp` requests call `counter`
- **THEN** the second `count` is `by` greater than the first

### Requirement: Inspector widget
The resource `ui://test/inspector.html` (MIME `text/html;profile=mcp-app`) SHALL contain a button per tool and print the raw request and the raw `CallToolResult`; a result with `isError: true` or a JSON-RPC error SHALL be highlighted with the `error` class. The widget SHALL follow the SDK handshake (`ui/initialize` with `appInfo`, then `ui/notifications/initialized`).

#### Scenario: Use from the studio
- **WHEN** the studio is opened with `?server=http://localhost:3200/mcp` and `live` is selected
- **THEN** the widget heading contains `Protocol Inspector` and the buttons call tools through passthrough

#### Scenario: Tool error shown as a result
- **WHEN** the `fail` button is pressed
- **THEN** the output contains `"isError": true` and `Intentional failure` with the `error` class

### Requirement: HTTP like example-server
`main.ts` SHALL mirror the example-server layout (express, CORS, `/health`, stateless `POST /mcp`, `HOST` default `127.0.0.1`) on port 3200. This is a deliberate copy: both packages stay free of shared dependencies.

#### Scenario: Health
- **WHEN** `GET /health` is requested
- **THEN** the answer is `{ ok: true }`

#### Scenario: Loopback by default
- **WHEN** `main.ts` starts without `HOST`
- **THEN** it listens on `127.0.0.1`

### Requirement: Inspector shows the tool lifecycle
The inspector SHALL print every `tool-input-partial`, `tool-input`, `tool-result` and `tool-cancelled` notification it receives, in a lifecycle log separate from the button output.

#### Scenario: Live call of the linked tool
- **WHEN** the studio plays the linked tool in live mode
- **THEN** the inspector's lifecycle log contains `tool-input` and `tool-result`
