## ADDED Requirements

### Requirement: Scenario tool call
`scenarioSchema` SHALL describe a scenario as `{ mocks?, toolCall? }`, where `toolCall` is `{ name?: non-empty string, input?: record, partialInputs?: record[], result? }` and `result` is a `static`, `error` or `passthrough` mock, or `{ kind: 'cancelled', reason?: string, delayMs? }`. `rpc-error` MUST NOT be accepted as a `toolCall.result`.

#### Scenario: Loading state as a delayed result
- **WHEN** a scenario has `toolCall: { name: 'get_metrics', result: { kind: 'static', structuredContent: {}, delayMs: 3_600_000 } }`
- **THEN** the schema accepts it

#### Scenario: rpc-error as a lifecycle result
- **WHEN** `toolCall.result` is `{ kind: 'rpc-error', error: { code: 1, message: 'x' } }`
- **THEN** the schema rejects it, naming `toolCall.result`
