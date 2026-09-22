# Reference Server (example-server)

## Purpose

`@studio/example-server` is the reference MCP Apps server on the public SDKs, intentionally free of workspace dependencies: it can be copied as a starting point. It exposes one tool and one UI resource; its `kpi-card.html` doubles as the studio's demo widget.

## Requirements

### Requirement: No workspace dependencies
The package MUST NOT depend on other monorepo packages; only `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `express`, `zod` are allowed.

#### Scenario: Copying into another project
- **WHEN** the package directory is copied outside the monorepo
- **THEN** `pnpm install && pnpm dev` works without editing imports

### Requirement: The get_metrics tool
The server SHALL register `get_metrics` with `_meta.ui.resourceUri` pointing at the UI resource, returning both a text `content` (the mandatory fallback for hosts without UI) and `structuredContent: { value, delta, label }`.

#### Scenario: Tool call
- **WHEN** a client calls `get_metrics`
- **THEN** `structuredContent` holds numeric `value`, `delta` and a string `label`
- **AND** `content[0].text` contains `Monthly active users`

### Requirement: UI resource
The server SHALL serve `ui://example/kpi-card.html` with MIME `text/html;profile=mcp-app`, reading the HTML from the file next to the source.

#### Scenario: Reading the resource
- **WHEN** a client reads `ui://example/kpi-card.html`
- **THEN** `mimeType` equals the SDK constant `RESOURCE_MIME_TYPE` and the text contains `ui/initialize`

### Requirement: One widget file
`kpi-card.html` SHALL be exported as `./kpi-card.html` and be the single source of the studio's demo widget; a second copy of this file MUST NOT exist in the repository.

#### Scenario: Editing the widget
- **WHEN** `kpi-card.html` changes
- **THEN** the change is visible both in live mode and in `vite dev` demo mode

### Requirement: Stateless HTTP with CORS
`main.ts` SHALL start express on `PORT` (default 3100), serve `/health`, create a fresh `McpServer` and `StreamableHTTPServerTransport` without a session id for every `POST /mcp`, and set CORS headers including `mcp-session-id` and `mcp-protocol-version` so the studio on another origin can connect.

#### Scenario: Browser preflight
- **WHEN** `OPTIONS /mcp` arrives
- **THEN** the status is `204` with `Access-Control-Allow-*` headers

### Requirement: Reference widget follows the SDK handshake
`kpi-card.html` SHALL send `ui/initialize` with `appInfo`, `appCapabilities` and `protocolVersion`, then `ui/notifications/initialized`, and SHALL read tool data from `structuredContent` of the `CallToolResult`, showing the text content of an `isError` result as its error state.

#### Scenario: Handshake in the studio
- **WHEN** the widget loads in the studio
- **THEN** the trace contains `ui/notifications/initialized` and no `invalid` events

#### Scenario: Tool error result
- **WHEN** `get_metrics` answers `isError: true` with `Metrics backend unavailable`
- **THEN** the status shows that text with the error class
