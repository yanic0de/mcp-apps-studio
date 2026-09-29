## ADDED Requirements

### Requirement: Recording a live session as a scenario
In the `live` scenario the studio SHALL offer "Save scenario", which converts the trace into a scenario valid under `scenarioSchema`: for every widget `tools/call` with a response, a mock for that tool from its last answer (`static` with the recorded `content` and `structuredContent`; `error` with the text of an `isError` result; `rpc-error` with the JSON-RPC error); and, when lifecycle notifications were pushed, a `toolCall` with the linked tool's `name`, the `tool-input` arguments as `input`, and the `tool-result` as a `static`/`error` result or `tool-cancelled` as a `cancelled` result. The scenario SHALL be added to the active widget as `recorded-<n>`, selected, and offered as a copyable snippet.

#### Scenario: Replay offline
- **WHEN** the user saves a scenario after the live KPI widget rendered and Refresh was pressed
- **THEN** a `recorded-1` scenario is selected, the widget renders the same value, and its trace contains no passthrough to the server

#### Scenario: Tool error recorded
- **WHEN** a recorded `tools/call` answered `isError: true` with `Intentional failure`
- **THEN** the recorded mock is `{ kind: 'error', message: 'Intentional failure' }`

#### Scenario: JSON-RPC error recorded
- **WHEN** a recorded `tools/call` was answered with `error: { code: -32601, message: 'nope' }`
- **THEN** the recorded mock is `{ kind: 'rpc-error', error: { code: -32601, message: 'nope' } }`
