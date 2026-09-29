## ADDED Requirements

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
