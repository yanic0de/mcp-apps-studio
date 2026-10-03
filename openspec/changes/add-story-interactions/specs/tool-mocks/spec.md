# Spec Delta

## ADDED Requirements

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
