# Proposal

## Why

The studio promises "what a real host does to a widget", but measured against the installed `@modelcontextprotocol/ext-apps@1.7.4` SDK (spec `2026-01-26`) the emulator diverges on the most common paths: it returns a bare `structuredContent` instead of a `CallToolResult` from `tools/call`, turns `isError` tool results into JSON-RPC errors, logs the SDK's mandatory `ui/notifications/initialized` as an invalid message, and answers `METHOD_NOT_FOUND` to every other View → Host request (`ui/open-link`, `ui/message`, `ui/request-display-mode`, `ui/update-model-context`, `ui/download-file`). A widget debugged in the studio can therefore break in Claude, and a widget built on the official `App` class cannot run in the studio without trace noise and failures. The "follow-up message method is unconfirmed" blocker is gone: `ui/message` is in the SDK.

## What Changes

- Wire methods: add every View ↔ Host method defined by the SDK to `MCP_APPS_METHODS`, with parameter schemas; drop the "follow-up messages not implemented" rule.
- **BREAKING** `tools/call` answers with an MCP `CallToolResult` (`content`, optional `structuredContent`, optional `isError`) from mocks and from live passthrough alike; tool failures are `isError` results, not JSON-RPC errors.
- **BREAKING** Mock kinds: `static` takes `structuredContent` and/or `content` (text fallback derived when `content` is omitted) instead of `result`; `error` takes `message` and produces an `isError` result; new `rpc-error` keeps the protocol-level JSON-RPC error.
- Handshake: host accepts `ui/notifications/initialized`; the initialize result advertises real `hostCapabilities` and a richer `hostContext` (`availableDisplayModes`, `platform`, `userAgent`).
- New widget intents: `ui/open-link`, `ui/message`, `ui/update-model-context`, `ui/download-file` get spec-shaped answers and are reported to the embedder; `ui/request-display-mode` switches the display mode (when available) and pushes `host-context-changed`; `notifications/message` and `ui/notifications/request-teardown` are accepted.
- Widget runtime: `connect()` sends `appInfo` and follows up with `ui/notifications/initialized`; `callTool` resolves with the `CallToolResult`; `useToolCall` exposes `structuredContent` as `data` and `isError` text as `error`.
- Vanilla reference widgets (example-server KPI card, test-server inspector) speak the same handshake and read `CallToolResult`.
- Conformance test: the official `App` from `@modelcontextprotocol/ext-apps` runs against `HostEmulator` in Node, so SDK drift breaks CI instead of users.

## Capabilities

### New Capabilities
- `sdk-conformance`: the emulator is exercised by the official ext-apps `App` client; defines which SDK flows must pass.

### Modified Capabilities
- `protocol`: full method list, new parameter schemas, `CallToolResult` schema; removes the follow-up-message prohibition.
- `host-adapter`: new semantic actions (initialized, intents, display-mode request, log, teardown request); real host capabilities in the initialize result.
- `host-emulator`: tool calls answer `CallToolResult`; handling of the new actions; context changes initiated by the widget.
- `tool-mocks`: new mock shapes (`static` with `structuredContent`/`content`, `error` → `isError`, `rpc-error`).
- `widget-runtime`: handshake with `appInfo` + `initialized`; `CallToolResult` from `callTool`; `useToolCall` unwrapping.
- `studio-app`: live passthrough returns the server's `CallToolResult` unchanged; widget-initiated display-mode changes show up in the controls.
- `example-server`, `test-server`: reference widgets follow the SDK handshake and read `CallToolResult`.
- `component-library`: stories use the new mock shapes.

## Impact

- Code: `packages/shared` (protocol, host-context, mocks), `packages/host-emulator` (adapter, emulator, mock router), `packages/widget-runtime`, `packages/components` (stories), `apps/studio` (mcp-client, Canvas, demo scenarios), vanilla widgets in `example-server` and `test-server`, e2e.
- Story files in user projects: `result:` → `structuredContent:`, `error: { code, message }` → `message:` (or `kind: 'rpc-error'`). Pre-1.0, no compatibility shim.
- Dependencies: `@modelcontextprotocol/ext-apps` and `@modelcontextprotocol/sdk` become dev dependencies of `@studio/host-emulator` (test only; runtime stays dependency-free).
