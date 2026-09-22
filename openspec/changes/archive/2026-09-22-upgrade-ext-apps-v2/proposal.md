# Proposal

## Why

`@modelcontextprotocol/ext-apps` 2.0.0 is the `latest` on npm and moves onto MCP TypeScript SDK v2 (`@modelcontextprotocol/client`, `core`, `server`, `node`, `express` instead of `@modelcontextprotocol/sdk`). A new user following the SDK's install instructions gets 2.x, which conflicts with our `^1.7.4` peers — the first release would greet them with a peer-dependency error. The wire protocol is unchanged (`2026-01-26`; a 2.x View works in a 1.x host and vice versa), so this is a packaging and API-surface migration.

## What Changes

- All packages move to `@modelcontextprotocol/ext-apps` `^2.0.0` and SDK v2 packages; `@modelcontextprotocol/sdk` (v1) is removed from the repo.
- `@mcp-apps-studio/widget-runtime` peers: `@modelcontextprotocol/ext-apps ^2`, `@modelcontextprotocol/client ^2`, `zod ^4.2`, optional `react`. **BREAKING** for consumers still on ext-apps 1.x.
- Reference servers use the v2 server stack (`McpServer` from `server`, `NodeStreamableHTTPServerTransport` from `node`, `createMcpExpressApp` from `express`), keep stateless HTTP and CORS.
- The studio's live client uses `@modelcontextprotocol/client`.
- Docs, `add` hint and the pack smoke test install the v2 peers.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `example-server`: allowed dependencies are the SDK v2 packages.
- `distribution`: widget-runtime peers target ext-apps 2 / SDK v2.

## Impact

- Code: every package.json using MCP SDKs, `example-server`/`test-server` (server + main + tests), `apps/studio/src/mcp-client.ts`, `widget-runtime` type imports and tsup externals, `scripts/pack-smoke.mjs`, docs.
- Protocol, adapter and emulator: unchanged — the conformance test (now on ext-apps 2) is the proof.
