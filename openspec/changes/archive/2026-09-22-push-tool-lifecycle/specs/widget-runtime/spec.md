## ADDED Requirements

### Requirement: Tool lifecycle subscriptions
`WidgetClient` SHALL provide `onToolInput(cb)`, `onToolInputPartial(cb)` (callback receives the `arguments` record, `{}` when absent), `onToolResult(cb)` (callback receives the `CallToolResult`) and `onToolCancelled(cb)` (callback receives `{ reason? }`), each returning an unsubscribe function. `dispose()` SHALL clear them. The `./react` subpath SHALL provide `useToolLifecycle<T>()` returning `{ status: 'waiting' | 'streaming' | 'input' | 'result' | 'error' | 'cancelled', input, data, error, reason }`, where `data` is the result's `structuredContent` and `error` the text of an `isError` result.

#### Scenario: Result after input
- **WHEN** the host sends `tool-input` with `{ arguments: { q: 1 } }` and then `tool-result` with `structuredContent: { v: 1 }`
- **THEN** the `onToolInput` subscriber receives `{ q: 1 }` and the `onToolResult` subscriber receives the result

#### Scenario: Unsubscribe
- **WHEN** a subscriber unsubscribes and another `tool-result` arrives
- **THEN** the subscriber is not called
