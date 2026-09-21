# Host Adapter

## Purpose

`HostAdapter` is a pure translator between the wire messages of one protocol dialect (currently only MCP Apps) and the emulator's semantic actions. No transport access, no side effects: this makes adapters testable against golden logs and lets a future `openai-apps` adapter plug in without touching the emulator or the studio.

## Requirements

### Requirement: Adapter contract
An adapter SHALL implement `id`, `buildIframeEnv`, `handleWidgetMessage`, `pushHostEvent`, `buildInitializeResult`, `capabilities` and MUST NOT access the transport, the DOM or mutable state.

#### Scenario: Same input, same output
- **WHEN** `handleWidgetMessage` is called twice with the same message
- **THEN** the results are structurally equal

### Requirement: Translating widget messages into actions
`McpAppsAdapter.handleWidgetMessage` SHALL translate: `ui/initialize` → `{ type: 'initialize' }`; `tools/call` → `{ type: 'tool-call', toolName, args }`; `resources/read` → `{ type: 'resource-read', uri }`; `ui/notifications/size-changed` → `{ type: 'size-changed', width?, height? }`; any other method → `{ type: 'unsupported', method }`. Actions MUST NOT carry a request id: answering with the original `id` is the bridge's job.

#### Scenario: Tool call
- **WHEN** `tools/call` arrives with `{ name: 'get_metrics', arguments: { q: 1 } }`
- **THEN** the action equals `{ type: 'tool-call', toolName: 'get_metrics', args: { q: 1 } }`

#### Scenario: Unknown method
- **WHEN** a request with method `wat/ever` arrives
- **THEN** the action equals `{ type: 'unsupported', method: 'wat/ever' }`

### Requirement: Parameter validation
For methods with a parameter schema the adapter SHALL validate `params` with the matching zod schema and on failure return `{ type: 'invalid-params', method, error }`, where `error` is a readable list of issues in the form `path: message` naming the field.

#### Scenario: tools/call without a name
- **WHEN** `tools/call` arrives with `{ arguments: {} }`
- **THEN** the action has type `invalid-params`
- **AND** `error` mentions the `name` field

#### Scenario: size-changed with a string
- **WHEN** `size-changed` arrives with `{ width: 'wide' }`
- **THEN** the action has type `invalid-params` and `method` equals the method name

### Requirement: Host events into wire notifications
`pushHostEvent({ type: 'context-changed', context })` SHALL return a `ui/notifications/host-context-changed` notification whose `params` equal the given context patch. For unknown events it SHALL return `null`.

#### Scenario: Theme change
- **WHEN** the host publishes `{ type: 'context-changed', context: { theme: 'dark' } }`
- **THEN** `{ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } }` is returned

### Requirement: Initialize result
`buildInitializeResult(ctx)` SHALL return an object with `protocolVersion` (the protocol constant), `hostCapabilities`, `hostInfo: { name: 'mcp-apps-studio', version }` and `hostContext: ctx`.

#### Scenario: Default context
- **WHEN** called with `defaultHostContext`
- **THEN** `hostContext.theme === 'light'`, `locale === 'en'`, `displayMode === 'inline'`

### Requirement: Iframe environment
`buildIframeEnv` SHALL return, for a `resource` source, mode `srcdoc` with the HTML; for a `dev` source, mode `src` with the URL; in both cases `sandbox` equals `['allow-scripts']`. The value `allow-same-origin` MUST NOT appear in `sandbox`. The optional `csp` field is passed to the iframe `csp` attribute (Chromium only).

#### Scenario: Widget from a resource
- **WHEN** the source is `{ kind: 'resource', uri, html }`
- **THEN** the environment equals `{ mode: 'srcdoc', content: html, sandbox: ['allow-scripts'] }`

#### Scenario: Dev widget by URL
- **WHEN** the source is `{ kind: 'dev', url }`
- **THEN** the environment equals `{ mode: 'src', content: url, sandbox: ['allow-scripts'] }`

### Requirement: Host capabilities
`capabilities()` SHALL list the supported display modes `inline`, `fullscreen`, `pip`. The studio UI SHALL build its display-mode selector from this list.

#### Scenario: Display-mode selector
- **WHEN** the studio renders the controls
- **THEN** the "Display" options equal `adapter.capabilities().displayModes`
