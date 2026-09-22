## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Executing an rpc-error mock
For an `rpc-error` mock the router SHALL, after `delayMs`, throw an `RpcError` with the given `code` and `message`.

#### Scenario: Host refuses the call
- **WHEN** the mock is `{ kind: 'rpc-error', error: { code: -32601, message: 'nope' } }`
- **THEN** `call` rejects with `RpcError(-32601, 'nope')`
