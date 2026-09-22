# Design

## Context

ext-apps 2.0 keeps `App`, `AppBridge`, `registerAppTool/registerAppResource`, method names and `LATEST_PROTOCOL_VERSION = "2026-01-26"`; its types now come from `@modelcontextprotocol/client` (`Transport`, `CallToolResult`, `Protocol`). The official example servers wire HTTP as `createMcpExpressApp()` + per-request `NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined })`.

## Goals / Non-Goals

**Goals:** zero `@modelcontextprotocol/sdk` in the repo; same behavior; conformance, unit, e2e and pack smoke green on 2.x.

**Non-Goals:** supporting ext-apps 1.x and 2.x at once (peer ranges would need to span two SDK generations with different type packages — not worth it pre-1.0); adopting new 2.x features.

## Decisions

- **Peers**: widget-runtime declares `@modelcontextprotocol/ext-apps` and `@modelcontextprotocol/client` (types + transport), not `core`/`server` — a View never needs the server side; `core` arrives with `client`.
- **Reference servers mirror the official examples** (`createMcpExpressApp` + `NodeStreamableHTTPServerTransport`) so they stay copy-pasteable documentation; our CORS middleware stays because the studio runs on another origin. `createMcpExpressApp` defaults to localhost host/origin validation, which matches the local-only use.
- **Tool input schemas become `z.object(...)`** as v2 requires Standard Schema objects.

## Risks / Trade-offs

- [Users pinned to ext-apps 1.x] → documented breaking change in the changeset; 0.x semantics.
- [Origin validation of `createMcpExpressApp` rejecting the studio's origin] → covered by live e2e; fall back to explicit `allowedOrigins` if needed.
