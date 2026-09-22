## MODIFIED Requirements

### Requirement: Host events into wire notifications
`pushHostEvent` SHALL translate `{ type: 'context-changed', context }` into `ui/notifications/host-context-changed` with `params` equal to the patch; `{ type: 'tool-input-partial', arguments }` into `ui/notifications/tool-input-partial` and `{ type: 'tool-input', arguments }` into `ui/notifications/tool-input`, both with `params: { arguments }`; `{ type: 'tool-result', result }` into `ui/notifications/tool-result` with the `CallToolResult` as `params`; `{ type: 'tool-cancelled', reason? }` into `ui/notifications/tool-cancelled` with `params: { reason? }`. For unknown events it SHALL return `null`.

#### Scenario: Theme change
- **WHEN** the host publishes `{ type: 'context-changed', context: { theme: 'dark' } }`
- **THEN** `{ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } }` is returned

#### Scenario: Tool result
- **WHEN** the host publishes `{ type: 'tool-result', result: { content: [], structuredContent: { v: 1 } } }`
- **THEN** the notification method is `ui/notifications/tool-result` and `params.structuredContent` equals `{ v: 1 }`
