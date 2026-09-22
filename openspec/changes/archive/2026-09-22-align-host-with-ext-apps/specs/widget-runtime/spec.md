## MODIFIED Requirements

### Requirement: Handshake
`connect()` SHALL send `ui/initialize` with `protocolVersion` (the protocol constant), `appInfo` (`{ name, version }` from the client options, defaulting to `{ name: 'studio-widget', version: '0.0.0' }`) and `appCapabilities: {}`, store `hostContext` from the result, then send `ui/notifications/initialized` and return the context.

#### Scenario: Successful initialization
- **WHEN** the host answers `{ protocolVersion, hostContext: { theme: 'dark', ... } }`
- **THEN** `connect()` resolves with that context
- **AND** `getHostContext()` returns the same
- **AND** the host receives `ui/notifications/initialized` after the response

### Requirement: Tool call
`callTool(name, args?)` SHALL send `tools/call` with `{ name, arguments: args ?? {} }` and resolve with the `CallToolResult` from the response. A response with `error` SHALL reject the promise with an `RpcError` carrying the host's `code`, `message` and `data`.

#### Scenario: Successful call
- **WHEN** the host answers `{ result: { content: [], structuredContent: { value: 1 } } }`
- **THEN** the promise resolves with that result

#### Scenario: Tool error
- **WHEN** the host answers `{ error: { code: -32000, message: 'boom' } }`
- **THEN** the promise rejects with an `RpcError` instance whose `code === -32000`

### Requirement: React wrappers
The `./react` subpath SHALL provide `WidgetProvider`, `useWidgetClient` (throws outside the provider), `useHostContext` and `useToolCall(name)` with `data`, `error`, `loading`, `call`. `useToolCall` SHALL expose `structuredContent` as `data`; a result with `isError: true` SHALL set `error` to its text content (or `tool call failed`) and keep `data` unchanged; a rejected call SHALL set `error` to the rejection message. The main entry `.` MUST NOT import React.

#### Scenario: Hook outside the provider
- **WHEN** `useWidgetClient()` is called without a `WidgetProvider`
- **THEN** an error mentioning `<WidgetProvider>` is thrown

#### Scenario: Tool error result
- **WHEN** the tool answers `{ isError: true, content: [{ type: 'text', text: 'db down' }] }`
- **THEN** the state holds `error: 'db down'` and `loading: false`
