# Widget Runtime

## Purpose

`@studio/widget-runtime` is the only sanctioned channel between a widget and the host. `WidgetClient` performs the handshake, calls tools and tracks host context; `applyHostContextToDocument` carries theme and CSS variables into the document; React hooks under the `./react` subpath wrap the client for components. The main entry stays React-free for vanilla widgets.

## Requirements

### Requirement: Handshake
`connect()` SHALL send `ui/initialize` with `protocolVersion` (the protocol constant) and `appCapabilities: {}`, store `hostContext` from the result and return it.

#### Scenario: Successful initialization
- **WHEN** the host answers `{ protocolVersion, hostContext: { theme: 'dark', ... } }`
- **THEN** `connect()` resolves with that context
- **AND** `getHostContext()` returns the same

### Requirement: Tool call
`callTool(name, args?)` SHALL send `tools/call` with `{ name, arguments: args ?? {} }` and return the response `result`. A response with `error` SHALL reject the promise with an `RpcError` carrying the host's `code`, `message` and `data`.

#### Scenario: Successful call
- **WHEN** the host answers `{ result: { value: 1 } }`
- **THEN** the promise resolves with `{ value: 1 }`

#### Scenario: Tool error
- **WHEN** the host answers `{ error: { code: -32000, message: 'boom' } }`
- **THEN** the promise rejects with an `RpcError` instance whose `code === -32000`

### Requirement: Timeout and correlation
The client SHALL correlate responses through `RequestTracker` with prefix `w`, reject a request on timeout (default 30 000 ms) and MUST NOT fire the timeout after a response arrived.

#### Scenario: No answer
- **WHEN** the host does not answer within `requestTimeoutMs`
- **THEN** the promise rejects with an error containing `timed out`

#### Scenario: Answer before the timeout
- **WHEN** a response is received and then more than the timeout elapses
- **THEN** the promise stays resolved; there is no second rejection

### Requirement: Send failure
If `postMessage` throws (e.g. `DataCloneError` for non-serializable arguments), the call's promise SHALL reject with that exception.

#### Scenario: Function in arguments
- **WHEN** `callTool('x', { fn: () => 1 })` and `postMessage` throws
- **THEN** the promise rejects with the exception text without waiting for the timeout

### Requirement: Host context
A `host-context-changed` notification SHALL merge into the stored context, and `onHostContextChanged` subscribers SHALL receive the patch. The unsubscribe function SHALL stop notifications.

#### Scenario: Theme change
- **WHEN** `{ params: { theme: 'light' } }` arrives after `connect()`
- **THEN** `getHostContext()` contains `theme: 'light'` and the previous `locale`
- **AND** the subscriber receives `{ theme: 'light' }`

### Requirement: Size notification
`sendSizeChanged({ width?, height? })` SHALL send a `ui/notifications/size-changed` notification with those params.

#### Scenario: Widget reports its size
- **WHEN** `sendSizeChanged({ width: 320, height: 200 })` is called
- **THEN** the host receives `{ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: 320, height: 200 } }`

### Requirement: Client disposal
`dispose()` SHALL remove the window listener, reject pending requests with an error containing `disposed` and clear subscribers. A request on a disposed client SHALL reject with the same error.

#### Scenario: Call during dispose
- **WHEN** `callTool('slow')` is awaiting an answer and `dispose()` is called
- **THEN** the promise rejects with an error matching `/disposed/`
- **AND** no listeners remain on the window

### Requirement: Ignoring garbage
Invalid messages and responses with unknown ids SHALL be ignored without exceptions.

#### Scenario: Garbage
- **WHEN** `null`, `{ evil: true }`, `{ jsonrpc: '2.0', id: 'unknown', result: 1 }` arrive
- **THEN** no exceptions; the context stays `null`

### Requirement: Testability in Node
The constructor SHALL accept a duck-typed `WidgetWindow` (`addEventListener`, `removeEventListener`, `parent.postMessage`), defaulting to the global `window`, evaluated lazily.

#### Scenario: Import in Node
- **WHEN** the module is imported in Node without `window`
- **THEN** the import does not fail; `window` is needed only when constructing a client with no arguments

### Requirement: Applying context to the document
`applyHostContextToDocument(ctx, doc?)` SHALL set `data-theme` on the root element when `ctx.theme` is present and set every variable from `ctx.styles.variables` via `style.setProperty`.

#### Scenario: Theme and variables
- **WHEN** `ctx = { theme: 'dark', styles: { variables: { '--color-bg': '#111' } } }`
- **THEN** `documentElement.dataset.theme === 'dark'`
- **AND** `--color-bg` equals `#111`

#### Scenario: Empty patch
- **WHEN** `ctx = {}`
- **THEN** nothing changes and no exception is thrown

### Requirement: React wrappers
The `./react` subpath SHALL provide `WidgetProvider`, `useWidgetClient` (throws outside the provider), `useHostContext` and `useToolCall(name)` with `data`, `error`, `loading`, `call`. The main entry `.` MUST NOT import React.

#### Scenario: Hook outside the provider
- **WHEN** `useWidgetClient()` is called without a `WidgetProvider`
- **THEN** an error mentioning `<WidgetProvider>` is thrown

### Requirement: Latest call wins
`useToolCall` (via `createToolCaller`) SHALL guarantee that with overlapping calls, the settlement of an earlier call never overwrites the state of a later one.

#### Scenario: Slow first, fast second
- **WHEN** the first `call()` is still pending and the second completed with data B
- **THEN** the state holds `data: B, loading: false`
- **AND** the first call's completion does not change the state
