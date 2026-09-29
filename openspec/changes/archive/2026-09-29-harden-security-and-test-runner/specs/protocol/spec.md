# Spec Delta: protocol

## MODIFIED Requirements

### Requirement: Method parameter schemas
The package SHALL provide zod parameter schemas: `tools/call` — `{ name: non-empty string, arguments?: unknown }`; `resources/read` — `{ uri: non-empty string }`; `size-changed` — `{ width?: number, height?: number }`; `ui/open-link` — `{ url: URL string with scheme http, https or mailto }`; `ui/message` — `{ role: 'user', content: array of content blocks }`; `ui/request-display-mode` — `{ mode: 'inline' | 'fullscreen' | 'pip' }`; `ui/update-model-context` — `{ content?: array of content blocks, structuredContent?: record }`; `ui/download-file` — `{ contents: array }`; `notifications/message` — `{ level: string, logger?: string, data: unknown }`. A content block is an object with a string `type`; other fields pass through.

#### Scenario: Empty tool name
- **WHEN** `tools/call` params contain `name: ""`
- **THEN** `toolsCallParamsSchema.safeParse` fails

#### Scenario: Size with one dimension missing
- **WHEN** `size-changed` params contain only `height`
- **THEN** the schema accepts them and `width` stays `undefined`

#### Scenario: Link that is not a URL
- **WHEN** `ui/open-link` params contain `url: 'not a url'`
- **THEN** the schema rejects them and the error names `url`

#### Scenario: Script URL
- **WHEN** `ui/open-link` params contain `url: 'javascript:alert(1)'` or a `data:` URL
- **THEN** the schema rejects them

#### Scenario: Web and mail links
- **WHEN** `ui/open-link` params contain `https://example.com/a` or `mailto:a@example.com`
- **THEN** the schema accepts them

#### Scenario: Unknown display mode
- **WHEN** `ui/request-display-mode` params contain `mode: 'sidebar'`
- **THEN** the schema rejects them
