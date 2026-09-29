# Host Emulator

## Purpose

`HostEmulator` is the only stateful orchestrator in the core. It composes the bridge, the adapter, the mock router and the resource table, holds the current `HostContext`, and turns the adapter's semantic actions into answers: the initialize result, a mock call, a resource read, protocol errors. Everything a real host does to a widget is reproduced here.

## Requirements

### Requirement: Initialize response
On an `initialize` action the emulator SHALL return `adapter.buildInitializeResult(current context)`.

#### Scenario: Widget handshake
- **WHEN** the widget sends `ui/initialize`
- **THEN** the response contains `protocolVersion` and a `hostContext` with the current theme

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

### Requirement: Resource reads
On a `resource-read` action the emulator SHALL return `{ contents: [{ uri, mimeType, text }] }` from the `resources` table, and for an unknown `uri` a `RESOURCE_NOT_FOUND` (-32002) error.

#### Scenario: Known resource
- **WHEN** `resources` contains `'ui://kpi': '<html>kpi</html>'` and the widget reads `ui://kpi`
- **THEN** `contents[0]` carries that `uri` and `text`

#### Scenario: Unknown resource
- **WHEN** the widget reads `ui://ghost`
- **THEN** the response contains an error with code `-32002`

### Requirement: Protocol errors
An `invalid-params` action SHALL become an `INVALID_PARAMS` (-32602) error with the issue text, `unsupported` a `METHOD_NOT_FOUND` (-32601). An action that makes no sense for a request (e.g. `size-changed`) SHALL yield `INTERNAL_ERROR`.

#### Scenario: Malformed call params
- **WHEN** the widget sends `tools/call` without `name`
- **THEN** the response contains `error.code === -32602`

#### Scenario: Unsupported method
- **WHEN** the widget sends a `wat/ever` request
- **THEN** the response contains `error.code === -32601`

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

### Requirement: Host context
The emulator SHALL hold a `HostContext` (default `defaultHostContext`); `setHostContext(patch)` SHALL merge the patch into the current context and, when the widget has completed the handshake (`ui/notifications/initialized` received) and the emulator is running, send the widget the notification produced by `adapter.pushHostEvent`. Before the handshake or after `stop()` it MUST NOT notify. Fields that changed after the `ui/initialize` response was produced but before `ui/notifications/initialized` arrived SHALL be sent in one `ui/notifications/host-context-changed` right after the handshake completes.

#### Scenario: Theme change
- **WHEN** `setHostContext({ theme: 'dark' })` is called after the handshake
- **THEN** the widget receives `ui/notifications/host-context-changed` with `params: { theme: 'dark' }`
- **AND** `getHostContext().theme === 'dark'`

#### Scenario: Change before the handshake
- **WHEN** `setHostContext({ theme: 'dark' })` is called before the widget sent `ui/initialize`
- **THEN** no notification is sent, and the `ui/initialize` result carries `theme: 'dark'`

#### Scenario: Change during the handshake
- **WHEN** `setHostContext({ theme: 'dark' })` is called after the `ui/initialize` response but before `ui/notifications/initialized`
- **THEN** right after `initialized` the widget receives `ui/notifications/host-context-changed` with `params: { theme: 'dark' }`

#### Scenario: Change after stop
- **WHEN** `stop()` was called and then `setHostContext({ theme: 'dark' })`
- **THEN** nothing is sent and `getHostContext().theme === 'dark'`

### Requirement: Swapping mocks at runtime
`setMocks(config)` SHALL replace the router configuration without recreating the emulator.

#### Scenario: New scenario
- **WHEN** the widget calls a tool after `setMocks`
- **THEN** the answer is determined by the new configuration

### Requirement: Resilience to garbage
The emulator SHALL keep serving valid requests after receiving invalid messages.

#### Scenario: Garbage, then a request
- **WHEN** the transport delivers `{ totally: 'garbage' }` followed by a valid `tools/call`
- **THEN** the trace has one `invalid` event
- **AND** `tools/call` receives the mock result

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

### Requirement: Tool lifecycle after initialization
When constructed with a `toolCall`, the emulator SHALL, upon the widget's `ui/notifications/initialized`, send each `partialInputs` entry as `tool-input-partial` in order, then exactly one `tool-input` with `input` (default `{}`), then, if `result` is set: for `cancelled` — `tool-cancelled` with `reason` after `delayMs`; otherwise the `CallToolResult` produced as for `tools/call` (delay, `isError`, passthrough with `input`) as `tool-result`. A result that fails to resolve SHALL produce `tool-cancelled` with the error message as `reason`. Nothing SHALL be sent after `stop()`, and a repeated `initialized` MUST NOT resend the lifecycle.

#### Scenario: Static result
- **WHEN** `toolCall` is `{ name: 'get_metrics', input: { q: 1 }, result: { kind: 'static', structuredContent: { v: 1 } } }` and the widget sends `initialized`
- **THEN** the widget receives `tool-input` with `{ arguments: { q: 1 } }` followed by `tool-result` with `structuredContent: { v: 1 }`

#### Scenario: Streaming arguments
- **WHEN** `partialInputs` is `[{ q: 'a' }, { q: 'ab' }]`
- **THEN** two `tool-input-partial` notifications arrive in that order before `tool-input`

#### Scenario: Passthrough failure
- **WHEN** `result` is `passthrough` and the handler rejects with `boom`
- **THEN** the widget receives `tool-cancelled` with `reason: 'boom'`

#### Scenario: Stopped while pending
- **WHEN** `result` has `delayMs: 1000` and the emulator is stopped after 10 ms
- **THEN** no `tool-result` is sent

### Requirement: Tool info in the host context
When constructed with a `toolCall` that has a `name`, the initialize result's `hostContext.toolInfo` SHALL be `{ tool: { name, inputSchema } }`, using the provided tool definition when given and `{ type: 'object' }` otherwise.

#### Scenario: Mocked tool
- **WHEN** `toolCall.name` is `get_metrics` and no definition is given
- **THEN** `hostContext.toolInfo` equals `{ tool: { name: 'get_metrics', inputSchema: { type: 'object' } } }`

### Requirement: New view instance on a new handshake
A `ui/initialize` received after the widget was ready SHALL start a new view instance: the emulator SHALL clear readiness and play the tool lifecycle again after the next `ui/notifications/initialized`. Within one handshake, a repeated `initialized` MUST NOT resend it.

#### Scenario: Frame reloaded by the dev server
- **WHEN** the widget completes the handshake, then sends `ui/initialize` and `initialized` again
- **THEN** it receives `tool-input` a second time

### Requirement: Resource teardown
`teardown({ timeoutMs })` (default 500 ms) SHALL, when the widget completed the handshake and the emulator is running, send the adapter's teardown request (`ui/resource-teardown` with `params: {}` for MCP Apps), wait for the response or the timeout, and then stop the emulator. Without a completed handshake it SHALL stop immediately. It MUST NOT reject.

#### Scenario: SDK widget acknowledges
- **WHEN** a widget built on the SDK `App` with an `onteardown` handler is torn down
- **THEN** the handler runs, the emulator receives the response and is stopped

#### Scenario: Silent widget
- **WHEN** the widget never answers the teardown request
- **THEN** `teardown()` resolves after the timeout and the emulator is stopped

#### Scenario: Before the handshake
- **WHEN** `teardown()` is called before `ui/notifications/initialized`
- **THEN** nothing is sent and the emulator is stopped
