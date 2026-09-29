# Spec Delta: example-server

## MODIFIED Requirements

### Requirement: Stateless HTTP with CORS
`main.ts` SHALL start express on `PORT` (default 3100) bound to `HOST` (default `127.0.0.1`, so the server is not reachable from the network unless asked), serve `/health`, create a fresh `McpServer` and `StreamableHTTPServerTransport` without a session id for every `POST /mcp`, and set CORS headers including `mcp-session-id` and `mcp-protocol-version` so the studio on another origin can connect. On start it SHALL print the URL it actually listens on.

#### Scenario: Browser preflight
- **WHEN** `OPTIONS /mcp` arrives
- **THEN** the status is `204` with `Access-Control-Allow-*` headers

#### Scenario: Loopback by default
- **WHEN** `main.ts` starts without `HOST`
- **THEN** it listens on `127.0.0.1` and `GET /health` there answers `{ ok: true }`
