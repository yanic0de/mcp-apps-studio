# Studio Application

## Purpose

`apps/studio` is the SPA where a developer observes a widget the way a host will see it: picks a widget and a scenario, switches theme and display mode, watches the RPC trace. UI state lives in Zustand and does not survive a reload. Everything protocol-specific the studio asks from the single `HostAdapter` instance.

## Requirements

### Requirement: Manifest loading with demo fallback
On start the studio SHALL request `/api/manifest`; if the response is not JSON, not `ok`, or the list is empty, it SHALL show the built-in demo widget (the `kpi-card.html` from example-server imported via `?raw`) with `default`, `loading`, `error`, `live` scenarios.

#### Scenario: Started through the CLI
- **WHEN** `/api/manifest` returns JSON with widgets
- **THEN** the studio shows them with the first one active

#### Scenario: Plain vite dev
- **WHEN** `/api/manifest` serves the SPA page instead of JSON
- **THEN** the studio shows the KPI demo widget

### Requirement: Selection state
The store SHALL hold `widgets`, `activeWidgetId`, `scenario`, `hostContext`, `log`. Switching widgets SHALL select its first scenario and clear the log; switching scenarios SHALL clear the log; context patches SHALL merge into the current context.

#### Scenario: Switching widgets
- **WHEN** the user selects widget `table` with scenarios `{ main }`
- **THEN** `scenario === 'main'` and `log` is empty

### Requirement: Capped trace with stable keys
The log SHALL keep at most 500 entries, dropping the oldest; every entry SHALL get a monotonic `seq` used as the React key, so an expanded row never shows another event's payload after the window slides.

#### Scenario: Overflow
- **WHEN** 510 events are appended
- **THEN** the log has 500 entries with unique `seq`
- **AND** the `seq` of a surviving entry is unchanged

### Requirement: Controls built from sources of truth
The "Widget" selector SHALL appear only with more than one widget. "Theme" options SHALL come from `hostContextSchema.shape.theme.options`, "Display" options from `adapter.capabilities().displayModes`; `<select>` values SHALL go through `schema.parse` rather than type casts.

#### Scenario: Single widget
- **WHEN** the manifest contains one widget
- **THEN** the "Widget" selector is not rendered

#### Scenario: Theme change
- **WHEN** the user selects `dark`
- **THEN** the store's context receives `theme: 'dark'`

### Requirement: Canvas renders through the adapter
Canvas SHALL build the iframe from `adapter.buildIframeEnv(source, hostContext)`: `sandbox` from `env.sandbox`, `srcDoc` or `src` by `env.mode`, the `csp` attribute when present. The iframe and emulator SHALL be recreated on widget or scenario change (`key`), while a `hostContext` change SHALL call `emulator.setHostContext` without recreation.

#### Scenario: Scenario change
- **WHEN** the user selects the `error` scenario
- **THEN** the iframe remounts, the widget redoes the handshake and receives the mock error

#### Scenario: Theme change without reload
- **WHEN** the user flips the theme
- **THEN** the widget receives `host-context-changed` and the iframe does not remount

### Requirement: Live scenario
In the `live` scenario the studio SHALL connect to the MCP server at the `?server=` URL (default `http://localhost:3100/mcp`) over streamable HTTP, find the resource by MIME `text/html;profile=mcp-app` (fallback: `ui://` prefix), read its HTML as the widget source, and proxy tool calls through passthrough.

#### Scenario: Example server
- **WHEN** the server on :3100 is running and `live` is selected
- **THEN** the widget renders from the server's resource and `get_metrics` returns the server's data

#### Scenario: Another server
- **WHEN** the studio is opened with `?server=http://127.0.0.1:3200/mcp`
- **THEN** live mode shows that server's widget

### Requirement: Tool errors in live mode
A result with `isError: true` SHALL become `RpcError(TOOL_ERROR, content text)`; when `structuredContent` is present the widget SHALL receive it, otherwise the whole result.

#### Scenario: The fail tool
- **WHEN** the server answers `isError: true` with the text `Intentional failure`
- **THEN** the widget receives a JSON-RPC error with code `-32000` and that text

### Requirement: Unreachable server
If the connection fails, the studio SHALL show the reason and a hint on starting a server or pointing at another with `?server=`, instead of an empty canvas.

#### Scenario: Server not running
- **WHEN** `live` is selected and the port is not listening
- **THEN** the canvas shows `Can't reach the MCP server: …` with the hint

### Requirement: Trace panel
The panel SHALL show an entry counter, one row per event with direction, method or `#id`, and kind; invalid entries SHALL be highlighted and show the reason; a row SHALL expand into the JSON payload; the `Clear` button SHALL empty the log.

#### Scenario: Expand and clear
- **WHEN** the user expands the `ui/initialize` row and presses `Clear`
- **THEN** the expanded row shows `"jsonrpc"`; after clearing there are no rows and the placeholder text is shown
