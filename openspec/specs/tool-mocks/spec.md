# Tool Mocks

## Purpose

A studio scenario is a set of mocks: how the emulator answers `tools/call` for each tool. `toolMockSchema` in `@studio/shared` is the single source for both the TypeScript type and story-file validation. `MockRouter` in `host-emulator` executes the configuration; its `passthrough` handler is the hook for a real MCP client.

## Requirements

### Requirement: Mock kinds
`toolMockSchema` SHALL allow exactly four kinds discriminated by `kind`: `static` (`structuredContent?: record`, `content?: content blocks`, `delayMs?`), `error` (`message: string`, `delayMs?`), `rpc-error` (`error: { code: integer, message: string }`, `delayMs?`), `passthrough` (no fields). `delayMs` SHALL be a non-negative integer.

#### Scenario: Misspelled kind
- **WHEN** a mock contains `kind: 'statik'`
- **THEN** the schema rejects it and the error text names the `kind` field

#### Scenario: Negative delay
- **WHEN** a mock contains `delayMs: -5` or `delayMs: 1.5`
- **THEN** the schema rejects it

#### Scenario: Null result
- **WHEN** the mock is `{ kind: 'static', structuredContent: null }`
- **THEN** the schema rejects it: MCP structured content is always an object

#### Scenario: Old result field
- **WHEN** a mock is `{ kind: 'static', result: { v: 1 } }`
- **THEN** the schema rejects it, so stale stories fail loudly at discovery instead of rendering nothing

### Requirement: Configuration keyed by tool name
`mockConfigSchema` SHALL be a "tool name → mock" dictionary and on failure SHALL include the tool name in the issue path.

#### Scenario: One tool broken
- **WHEN** the configuration is `{ ok: { kind: 'passthrough' }, bad: { kind: 'rpc-error', error: {} } }`
- **THEN** the error contains the path `bad.error.`

### Requirement: Executing a static mock
`MockRouter.call` SHALL wait `delayMs` (if set) and return a `CallToolResult`: `content` as given, or, when omitted, one text block with the JSON of `structuredContent` (empty array if neither is given); `structuredContent` as given.

#### Scenario: Delay for a loading state
- **WHEN** the mock is `{ kind: 'static', structuredContent: { v: 1 }, delayMs: 3_600_000 }`
- **THEN** the promise does not resolve for an hour and the widget stays in its loading state

#### Scenario: Derived text fallback
- **WHEN** the mock is `{ kind: 'static', structuredContent: { v: 1 } }`
- **THEN** the result equals `{ content: [{ type: 'text', text: '{"v":1}' }], structuredContent: { v: 1 } }`

### Requirement: Executing an error mock
For an `error` mock the router SHALL, after `delayMs`, return `{ isError: true, content: [{ type: 'text', text: message }] }`.

#### Scenario: Backend error
- **WHEN** the mock is `{ kind: 'error', message: 'Metrics backend unavailable' }`
- **THEN** `call` resolves with `isError: true` and that text in `content[0]`

### Requirement: Passthrough
If a tool has no mock, or its mock is `passthrough`, the router SHALL invoke the `passthrough(toolName, args)` handler. Without a handler it SHALL throw `RpcError(METHOD_NOT_FOUND)` with a message naming the tool.

#### Scenario: Live mode
- **WHEN** the `live` scenario has empty mocks and an MCP server is connected
- **THEN** every `tools/call` is proxied to the real server through the handler

#### Scenario: Neither mock nor handler
- **WHEN** `unknown_tool` is not configured and no passthrough is set
- **THEN** `call` rejects with error `-32601` mentioning `unknown_tool`

### Requirement: Executing an rpc-error mock
For an `rpc-error` mock the router SHALL, after `delayMs`, throw an `RpcError` with the given `code` and `message`.

#### Scenario: Host refuses the call
- **WHEN** the mock is `{ kind: 'rpc-error', error: { code: -32601, message: 'nope' } }`
- **THEN** `call` rejects with `RpcError(-32601, 'nope')`

### Requirement: Scenario tool call
`scenarioSchema` SHALL describe a scenario as `{ mocks?, toolCall? }`, where `toolCall` is `{ name?: non-empty string, input?: record, partialInputs?: record[], result? }` and `result` is a `static`, `error` or `passthrough` mock, or `{ kind: 'cancelled', reason?: string, delayMs? }`. `rpc-error` MUST NOT be accepted as a `toolCall.result`.

#### Scenario: Loading state as a delayed result
- **WHEN** a scenario has `toolCall: { name: 'get_metrics', result: { kind: 'static', structuredContent: {}, delayMs: 3_600_000 } }`
- **THEN** the schema accepts it

#### Scenario: rpc-error as a lifecycle result
- **WHEN** `toolCall.result` is `{ kind: 'rpc-error', error: { code: 1, message: 'x' } }`
- **THEN** the schema rejects it, naming `toolCall.result`

### Requirement: Scenario steps
`scenarioSchema` SHALL accept an optional `steps` array, validated by the same schema that types it. Each step MUST be exactly one of:
- `{ click: selector, timeoutMs? }`
- `{ fill: selector, value: string, timeoutMs? }`
- `{ press: key, on?: selector, timeoutMs? }`
- `{ expectToolCall: { name: non-empty string, arguments?: record }, timeoutMs? }`
- `{ expectMessage: { method: non-empty string, params?: unknown }, timeoutMs? }`

Selectors and keys MUST be non-empty strings, and `timeoutMs` MUST be a positive integer. A step with unknown fields, or with fields from two step kinds, MUST be rejected.

#### Scenario: Click then expect a tool call
- **WHEN** a scenario has `steps: [{ click: 'button.refresh' }, { expectToolCall: { name: 'get_metrics' } }]`
- **THEN** the schema accepts it

#### Scenario: Misspelled step
- **WHEN** a step is `{ clik: 'button' }`
- **THEN** the schema rejects it and the error path names `steps.0`

#### Scenario: Two kinds in one step
- **WHEN** a step is `{ click: 'button', expectToolCall: { name: 'x' } }`
- **THEN** the schema rejects it

#### Scenario: Empty selector
- **WHEN** a step is `{ click: '' }`
- **THEN** the schema rejects it
