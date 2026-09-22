## MODIFIED Requirements

### Requirement: Tool calls through the mock router
On a `tool-call` action the emulator SHALL delegate to `MockRouter.call(toolName, args)` and return its `CallToolResult` as the JSON-RPC `result`; an `RpcError` from the router SHALL become a JSON-RPC `error`. Tool failures SHALL reach the widget as a result with `isError: true`, not as a JSON-RPC error.

#### Scenario: Static mock
- **WHEN** the scenario contains `get_metrics: { kind: 'static', structuredContent: { rows: [1, 2] } }`
- **THEN** the response `result.structuredContent` equals `{ rows: [1, 2] }`
- **AND** `result.content[0]` is a text block

#### Scenario: Error mock
- **WHEN** the scenario contains `get_metrics: { kind: 'error', message: 'db down' }`
- **THEN** the response `result` equals `{ isError: true, content: [{ type: 'text', text: 'db down' }] }`

#### Scenario: RPC error mock
- **WHEN** the scenario contains `get_metrics: { kind: 'rpc-error', error: { code: -32000, message: 'db down' } }`
- **THEN** the response contains `error: { code: -32000, message: 'db down' }`

### Requirement: Widget notifications
A `size-changed` notification SHALL invoke `onSizeChanged({ width, height })`. `initialized` SHALL mark the widget as ready (`isReady() === true`). `log` and `request-teardown` SHALL be reported through `onWidgetIntent`. Since notifications have no reply channel, `invalid-params` and `unsupported` for notifications SHALL land in the trace as a `kind: 'invalid'` event with `method` and reason, and `onSizeChanged` MUST NOT be invoked.

#### Scenario: Valid size
- **WHEN** the widget notifies `size-changed` with `{ width: 320, height: 240 }`
- **THEN** `onSizeChanged` receives `{ width: 320, height: 240 }`

#### Scenario: Size with malformed params
- **WHEN** the widget notifies `size-changed` with `{ width: 'wide' }`
- **THEN** the trace has exactly one `invalid` event with `method: 'ui/notifications/size-changed'`
- **AND** `onSizeChanged` is not invoked

#### Scenario: Initialized
- **WHEN** the widget sends `ui/notifications/initialized` after the handshake
- **THEN** `isReady()` returns `true`
- **AND** the trace has no `invalid` event

#### Scenario: Unknown notification
- **WHEN** the widget sends a `wat/notification` notification
- **THEN** an `invalid` event with that method appears in the trace

## ADDED Requirements

### Requirement: Widget intents
For `open-link`, `message`, `update-model-context` and `download-file` actions the emulator SHALL call `onWidgetIntent(action)` and answer `{}` (success).

#### Scenario: Open link
- **WHEN** the widget requests `ui/open-link` with `{ url: 'https://example.com' }`
- **THEN** `onWidgetIntent` receives `{ type: 'open-link', url: 'https://example.com' }`
- **AND** the response `result` equals `{}`

#### Scenario: Follow-up message
- **WHEN** the widget requests `ui/message` with a text block
- **THEN** `onWidgetIntent` receives a `message` action with that content and the response is a success

### Requirement: Display mode requested by the widget
On `request-display-mode` the emulator SHALL, if the mode is among `adapter.capabilities().displayModes`, set it in the host context, send `host-context-changed` with `{ displayMode }`, call `onHostContextChanged(context)` and answer `{ mode }`; otherwise it SHALL leave the context unchanged and answer `{ mode: <current mode> }`.

#### Scenario: Supported mode
- **WHEN** the widget requests `fullscreen` while `inline`
- **THEN** the response equals `{ mode: 'fullscreen' }`
- **AND** the widget receives `host-context-changed` with `{ displayMode: 'fullscreen' }`
- **AND** `onHostContextChanged` receives a context with `displayMode: 'fullscreen'`
