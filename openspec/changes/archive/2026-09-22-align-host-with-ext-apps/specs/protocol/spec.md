## MODIFIED Requirements

### Requirement: Method names in one place
Wire method names SHALL live only in the `MCP_APPS_METHODS` object and SHALL match the method constants of the `@modelcontextprotocol/ext-apps` SDK. View → host requests: `ui/initialize`, `tools/call`, `resources/read`, `ui/open-link`, `ui/message`, `ui/request-display-mode`, `ui/update-model-context`, `ui/download-file`. View → host notifications: `ui/notifications/initialized`, `ui/notifications/size-changed`, `ui/notifications/request-teardown`, `notifications/message`. Host → view: `ui/notifications/host-context-changed`, `ui/notifications/tool-input`, `ui/notifications/tool-input-partial`, `ui/notifications/tool-result`, `ui/notifications/tool-cancelled`, `ui/resource-teardown`. Code outside `protocol.ts` MUST NOT contain these strings as literals, except self-contained reference widgets that cannot import workspace packages.

#### Scenario: A method is renamed in the spec
- **WHEN** a method name changes in a new SEP-1865 version
- **THEN** changing the value in `MCP_APPS_METHODS` is sufficient
- **AND** the adapter, the widget client and the tests keep referring to the same field

#### Scenario: Names match the SDK
- **WHEN** the SDK's exported method constants (`OPEN_LINK_METHOD`, `MESSAGE_METHOD`, `INITIALIZED_METHOD`, …) are compared with `MCP_APPS_METHODS`
- **THEN** every SDK method used by this project has an equal value in `MCP_APPS_METHODS`

### Requirement: Method parameter schemas
The package SHALL provide zod parameter schemas: `tools/call` — `{ name: non-empty string, arguments?: unknown }`; `resources/read` — `{ uri: non-empty string }`; `size-changed` — `{ width?: number, height?: number }`; `ui/open-link` — `{ url: URL string }`; `ui/message` — `{ role: 'user', content: array of content blocks }`; `ui/request-display-mode` — `{ mode: 'inline' | 'fullscreen' | 'pip' }`; `ui/update-model-context` — `{ content?: array of content blocks, structuredContent?: record }`; `ui/download-file` — `{ contents: array }`; `notifications/message` — `{ level: string, logger?: string, data: unknown }`. A content block is an object with a string `type`; other fields pass through.

#### Scenario: Empty tool name
- **WHEN** `tools/call` params contain `name: ""`
- **THEN** `toolsCallParamsSchema.safeParse` fails

#### Scenario: Size with one dimension missing
- **WHEN** `size-changed` params contain only `height`
- **THEN** the schema accepts them and `width` stays `undefined`

#### Scenario: Link that is not a URL
- **WHEN** `ui/open-link` params contain `url: 'not a url'`
- **THEN** the schema rejects them and the error names `url`

#### Scenario: Unknown display mode
- **WHEN** `ui/request-display-mode` params contain `mode: 'sidebar'`
- **THEN** the schema rejects them

## ADDED Requirements

### Requirement: Tool call result schema
The package SHALL provide `callToolResultSchema` for the MCP `CallToolResult`: `content` — array of content blocks (default `[]`), `structuredContent?` — record, `isError?` — boolean, `_meta?` — record. It SHALL be the single definition of the shape answered to `tools/call`.

#### Scenario: Result with structured content
- **WHEN** `{ content: [{ type: 'text', text: 'ok' }], structuredContent: { v: 1 } }` is parsed
- **THEN** it is accepted unchanged

#### Scenario: Bare payload
- **WHEN** `{ value: 1 }` without `content` or `structuredContent` is parsed
- **THEN** it is accepted with `content: []` and no `structuredContent`, so a bare payload never reaches the widget as structured data

## REMOVED Requirements

### Requirement: Widget follow-up messages are not implemented from memory
**Reason**: `ui/message` is defined by the installed `@modelcontextprotocol/ext-apps` SDK, so the method is confirmed; the conformance test now guards against guessing.
**Migration**: Nothing to migrate; unknown methods still get `METHOD_NOT_FOUND` (see host-adapter and host-emulator).
