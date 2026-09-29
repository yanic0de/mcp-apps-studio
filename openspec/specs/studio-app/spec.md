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
In the `live` scenario the studio SHALL connect to the MCP server at the `?server=` URL (default `http://localhost:3100/mcp`) over streamable HTTP, find the resource by MIME `text/html;profile=mcp-app` (fallback: `ui://` prefix), read its HTML as the widget source, proxy tool calls through passthrough, and find the linked tool (the first tool whose `_meta.ui.resourceUri` equals the resource URI). The studio SHALL then play the model's call: the scenario's `toolCall` with `name` defaulting to the linked tool, `input` to `{}` and `result` to `passthrough`, using the linked tool's definition for `toolInfo`.

#### Scenario: Example server
- **WHEN** the server on :3100 is running and `live` is selected
- **THEN** the widget renders from the server's resource and receives `tool-result` with the data of the server's `get_metrics`

#### Scenario: Another server
- **WHEN** the studio is opened with `?server=http://127.0.0.1:3200/mcp`
- **THEN** live mode shows that server's widget

### Requirement: Tool errors in live mode
In live mode the studio SHALL forward the server's `CallToolResult` to the widget unchanged, including `isError: true` results. Only transport or protocol failures SHALL become a JSON-RPC error, keeping the MCP error code when the client exposes one and `INTERNAL_ERROR` otherwise.

#### Scenario: The fail tool
- **WHEN** the server answers `isError: true` with the text `Intentional failure`
- **THEN** the widget receives a result with `isError: true` and that text in `content`

#### Scenario: Structured data
- **WHEN** the server answers with `content` and `structuredContent`
- **THEN** the widget receives both

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

### Requirement: Widget-initiated context changes
When the emulator reports a context change initiated by the widget (e.g. an accepted display-mode request), the studio SHALL store that context so the controls reflect it, and MUST NOT send the same change back to the widget.

#### Scenario: Widget goes fullscreen
- **WHEN** the widget requests `fullscreen` and the emulator accepts it
- **THEN** the "Display" control shows `fullscreen`
- **AND** the trace has exactly one `host-context-changed` for that change

### Requirement: Scenario tool call reaches the emulator
Canvas SHALL pass the active scenario's `toolCall` to the emulator, so the lifecycle notifications of every mock scenario appear in the trace after `ui/notifications/initialized`.

#### Scenario: Demo default scenario
- **WHEN** the demo widget loads in the `default` scenario
- **THEN** the trace shows `ui/notifications/tool-input` and `ui/notifications/tool-result` after `ui/notifications/initialized`

### Requirement: Frame follows the widget and the display mode
The canvas SHALL size the iframe by display mode and device: `inline` — the device column width and the height last reported by `size-changed` (default 240) clamped to 40…800; `pip` — width `min(360, column)` and the reported height clamped to 40…320, shown as a floating box; `fullscreen` — the canvas area minus a 16 px gutter (on `mobile`, the column width by the canvas height). The widget-reported width MUST NOT change the frame width.

#### Scenario: Widget reports its height
- **WHEN** the widget sends `size-changed` with `{ height: 190 }` in `inline` mode on `desktop`
- **THEN** the iframe is 640 px wide and 190 px high

#### Scenario: Height beyond the inline maximum
- **WHEN** the widget reports `{ height: 5000 }` inline
- **THEN** the iframe is 800 px high

#### Scenario: Fullscreen
- **WHEN** the user selects `fullscreen`
- **THEN** the iframe fills the canvas minus the gutter

### Requirement: Device presets
The studio SHALL offer `desktop` (column 640, `platform: 'web'`, hover, no touch) and `mobile` (column 375, `platform: 'mobile'`, touch, no hover, `safeAreaInsets` `{ top: 47, right: 0, bottom: 34, left: 0 }`) through a "Device" selector; the selected preset's fields SHALL be part of the host context.

#### Scenario: Switch to mobile
- **WHEN** the user selects `mobile`
- **THEN** the widget receives `host-context-changed` with `platform: 'mobile'` and `deviceCapabilities: { touch: true, hover: false }`
- **AND** the inline frame is 375 px wide

### Requirement: Container dimensions in the host context
The host context SHALL carry `containerDimensions` for the current mode and device — inline `{ width: column, maxHeight: 800 }`, pip `{ width, maxHeight: 320 }`, fullscreen `{ width, height }` of the frame — and SHALL be updated only when these values change.

#### Scenario: Fullscreen dimensions
- **WHEN** the mode becomes `fullscreen` on a 1000×700 canvas on `desktop`
- **THEN** `containerDimensions` equals `{ width: 968, height: 668 }`

### Requirement: Recording a live session as a scenario
In the `live` scenario the studio SHALL offer "Save scenario", which converts the trace into a scenario valid under `scenarioSchema`: for every widget `tools/call` with a response, a mock for that tool from its last answer (`static` with the recorded `content` and `structuredContent`; `error` with the text of an `isError` result; `rpc-error` with the JSON-RPC error); and, when lifecycle notifications were pushed, a `toolCall` with the linked tool's `name`, the `tool-input` arguments as `input`, and the `tool-result` as a `static`/`error` result or `tool-cancelled` as a `cancelled` result. The scenario SHALL be added to the active widget as `recorded-<n>`, selected, and offered as a copyable snippet.

#### Scenario: Replay offline
- **WHEN** the user saves a scenario after the live KPI widget rendered and Refresh was pressed
- **THEN** a `recorded-1` scenario is selected, the widget renders the same value, and its trace contains no passthrough to the server

#### Scenario: Tool error recorded
- **WHEN** a recorded `tools/call` answered `isError: true` with `Intentional failure`
- **THEN** the recorded mock is `{ kind: 'error', message: 'Intentional failure' }`

#### Scenario: JSON-RPC error recorded
- **WHEN** a recorded `tools/call` was answered with `error: { code: -32601, message: 'nope' }`
- **THEN** the recorded mock is `{ kind: 'rpc-error', error: { code: -32601, message: 'nope' } }`

### Requirement: Deep links
After the manifest loads, the studio SHALL apply the URL parameters `widget` (widget id), `scenario`, `theme`, `display` and `device` to the initial state; a value that does not name an existing widget/scenario or a valid option SHALL be ignored.

#### Scenario: Open a scenario directly
- **WHEN** the studio is opened with `?scenario=error&theme=dark`
- **THEN** the `error` scenario is selected and the host context theme is `dark`

#### Scenario: Unknown scenario
- **WHEN** the studio is opened with `?scenario=nope`
- **THEN** the first scenario stays selected

### Requirement: Automation hook
The studio SHALL expose `window.__mcpStudio.getLog()` returning the current trace entries and `window.__mcpStudio.getActive()` returning `{ widget, scenario, theme }` of what the canvas renders (`widget` is `null` when no widget is loaded); the hook MUST NOT allow changing studio state.

#### Scenario: Reading the trace
- **WHEN** an automation script calls `window.__mcpStudio.getLog()` after the widget loaded
- **THEN** it receives entries including `ui/initialize`

#### Scenario: Reading the rendered target
- **WHEN** the studio shows widget `table`, scenario `empty` in dark theme and `getActive()` is called
- **THEN** it returns `{ widget: 'table', scenario: 'empty', theme: 'dark' }`

#### Scenario: Unknown deep link is visible
- **WHEN** the studio is opened with `?widget=ghost` and `getActive()` is called
- **THEN** `widget` is not `ghost`

### Requirement: Dev-server widgets
For a manifest entry with `url`, Canvas SHALL render the iframe from `adapter.buildIframeEnv({ kind: 'dev', url })` (`src`, same sandbox), so the dev server's own HMR runs inside the widget.

#### Scenario: Widget from Vite
- **WHEN** the active widget's entry is `{ url: 'http://localhost:5173/' }`
- **THEN** the iframe `src` is that URL with `sandbox="allow-scripts"`

### Requirement: Live reload
When served by the CLI, the studio SHALL subscribe to `/api/events`; on a `manifest` event it SHALL reload the manifest, keep the selected widget and scenario when they still exist, and remount the widget.

#### Scenario: Scenario data edited
- **WHEN** the mocked value in the active scenario is changed in the story file
- **THEN** the widget shows the new value without a manual refresh, in the same scenario

### Requirement: Discovery errors banner
The studio SHALL show discovery `errors` (file and message) in a banner above the canvas while they exist.

#### Scenario: Broken story
- **WHEN** the manifest has an error for `broken.stories.mcp.ts`
- **THEN** the banner names that file and the working widgets stay usable
