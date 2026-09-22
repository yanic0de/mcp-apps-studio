## MODIFIED Requirements

### Requirement: Translating widget messages into actions
`McpAppsAdapter.handleWidgetMessage` SHALL translate: `ui/initialize` → `{ type: 'initialize' }`; `ui/notifications/initialized` → `{ type: 'initialized' }`; `tools/call` → `{ type: 'tool-call', toolName, args }`; `resources/read` → `{ type: 'resource-read', uri }`; `ui/notifications/size-changed` → `{ type: 'size-changed', width?, height? }`; `ui/open-link` → `{ type: 'open-link', url }`; `ui/message` → `{ type: 'message', role, content }`; `ui/request-display-mode` → `{ type: 'request-display-mode', mode }`; `ui/update-model-context` → `{ type: 'update-model-context', content?, structuredContent? }`; `ui/download-file` → `{ type: 'download-file', contents }`; `notifications/message` → `{ type: 'log', level, logger?, data }`; `ui/notifications/request-teardown` → `{ type: 'request-teardown' }`; any other method → `{ type: 'unsupported', method }`. Actions MUST NOT carry a request id: answering with the original `id` is the bridge's job.

#### Scenario: Tool call
- **WHEN** `tools/call` arrives with `{ name: 'get_metrics', arguments: { q: 1 } }`
- **THEN** the action equals `{ type: 'tool-call', toolName: 'get_metrics', args: { q: 1 } }`

#### Scenario: Initialized notification
- **WHEN** `ui/notifications/initialized` arrives without params
- **THEN** the action equals `{ type: 'initialized' }`

#### Scenario: Open link
- **WHEN** `ui/open-link` arrives with `{ url: 'https://example.com' }`
- **THEN** the action equals `{ type: 'open-link', url: 'https://example.com' }`

#### Scenario: Unknown method
- **WHEN** a request with method `wat/ever` arrives
- **THEN** the action equals `{ type: 'unsupported', method: 'wat/ever' }`

### Requirement: Initialize result
`buildInitializeResult(ctx)` SHALL return an object with `protocolVersion` (the protocol constant), `hostInfo: { name: 'mcp-apps-studio', version }`, `hostCapabilities` advertising `openLinks`, `downloadFile`, `serverTools`, `serverResources`, `logging`, `message` and `updateModelContext`, and `hostContext` equal to `ctx` plus `availableDisplayModes` from `capabilities()`.

#### Scenario: Default context
- **WHEN** called with `defaultHostContext`
- **THEN** `hostContext.theme === 'light'`, `locale === 'en'`, `displayMode === 'inline'`, `platform === 'web'`
- **AND** `hostContext.availableDisplayModes` equals `capabilities().displayModes`

#### Scenario: Capabilities advertised
- **WHEN** the result is built
- **THEN** `hostCapabilities` has the keys `openLinks`, `downloadFile`, `serverTools`, `serverResources`, `logging`, `message`, `updateModelContext`
