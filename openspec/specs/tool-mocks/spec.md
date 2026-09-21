# Tool Mocks

## Purpose

A studio scenario is a set of mocks: how the emulator answers `tools/call` for each tool. `toolMockSchema` in `@studio/shared` is the single source for both the TypeScript type and story-file validation. `MockRouter` in `host-emulator` executes the configuration; its `passthrough` handler is the hook for a real MCP client.

## Requirements

### Requirement: Mock kinds
`toolMockSchema` SHALL allow exactly three kinds discriminated by `kind`: `static` (`result: unknown`, `delayMs?`), `error` (`error: { code: integer, message: string }`, `delayMs?`), `passthrough` (no fields). `delayMs` SHALL be a non-negative integer.

#### Scenario: Misspelled kind
- **WHEN** a mock contains `kind: 'statik'`
- **THEN** the schema rejects it and the error text names the `kind` field

#### Scenario: Negative delay
- **WHEN** a mock contains `delayMs: -5` or `delayMs: 1.5`
- **THEN** the schema rejects it

#### Scenario: Null result
- **WHEN** the mock is `{ kind: 'static', result: null }`
- **THEN** the schema accepts it, preserving `result: null`

### Requirement: Configuration keyed by tool name
`mockConfigSchema` SHALL be a "tool name → mock" dictionary and on failure SHALL include the tool name in the issue path.

#### Scenario: One tool broken
- **WHEN** the configuration is `{ ok: { kind: 'passthrough' }, bad: { kind: 'error', error: {} } }`
- **THEN** the error contains the path `bad.error.`

### Requirement: Executing a static mock
`MockRouter.call` SHALL wait `delayMs` (if set) and return `result`.

#### Scenario: Delay for a loading state
- **WHEN** the mock is `{ kind: 'static', result: 1, delayMs: 3_600_000 }`
- **THEN** the promise does not resolve for an hour and the widget stays in its loading state

### Requirement: Executing an error mock
For an `error` mock the router SHALL, after `delayMs`, throw an `RpcError` with the given `code` and `message`.

#### Scenario: Backend error
- **WHEN** the mock is `{ kind: 'error', error: { code: -32000, message: 'Metrics backend unavailable' } }`
- **THEN** `call` rejects with `RpcError(-32000, 'Metrics backend unavailable')`

### Requirement: Passthrough
If a tool has no mock, or its mock is `passthrough`, the router SHALL invoke the `passthrough(toolName, args)` handler. Without a handler it SHALL throw `RpcError(METHOD_NOT_FOUND)` with a message naming the tool.

#### Scenario: Live mode
- **WHEN** the `live` scenario has empty mocks and an MCP server is connected
- **THEN** every `tools/call` is proxied to the real server through the handler

#### Scenario: Neither mock nor handler
- **WHEN** `unknown_tool` is not configured and no passthrough is set
- **THEN** `call` rejects with error `-32601` mentioning `unknown_tool`
