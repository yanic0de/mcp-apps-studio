# Tasks

## 1. Shared protocol

- [x] 1.1 Extend `MCP_APPS_METHODS` with every SDK method and add param schemas (open-link, message, request-display-mode, update-model-context, download-file, logging) — verify with new cases in `packages/shared/src/protocol.test.ts`
- [x] 1.2 Add `callToolResultSchema` + `CallToolResult` type — verify bare payload and structured cases in `protocol.test.ts`
- [x] 1.3 Extend `hostContextSchema` (availableDisplayModes, timeZone, platform, userAgent, deviceCapabilities, containerDimensions union) and `defaultHostContext` (platform, userAgent) — verify in `host-context.test.ts`
- [x] 1.4 New mock kinds (`static` with structuredContent/content, `error` with message, `rpc-error`) — verify rejects `result:`, null structuredContent, broken rpc-error path in `mocks.test.ts`

## 2. Host emulator

- [x] 2.1 `MockRouter` returns `CallToolResult` for static/error and throws for rpc-error — verify in `mock-router.test.ts`
- [x] 2.2 Adapter actions for initialized, open-link, message, request-display-mode, update-model-context, download-file, log, request-teardown; initialize result with capabilities and availableDisplayModes — verify in `mcp-apps-adapter.test.ts`
- [x] 2.3 `HostEmulator`: `isReady`, `onWidgetIntent`, display-mode handling with `onHostContextChanged` — verify in `host-emulator.test.ts`
- [x] 2.4 Add ext-apps + MCP SDK dev deps and `sdk-conformance.test.ts` driving the official `App` — verify it passes

## 3. Widget side

- [x] 3.1 `WidgetClient.connect` sends `appInfo` then `initialized`; `callTool` returns `CallToolResult` — verify in `client.test.ts`
- [x] 3.2 `createToolCaller`/`useToolCall` unwrap `structuredContent` and `isError` — verify in `tool-caller.test.ts`
- [x] 3.3 Migrate component stories to new mock shapes — verify `pnpm vitest run packages/components packages/cli`
- [x] 3.4 Vanilla widgets (`kpi-card.html`, `inspector.html`) follow the SDK handshake and read `CallToolResult` — verify with example/test server tests and e2e

## 4. Studio

- [x] 4.1 Live passthrough forwards `CallToolResult` unchanged, maps thrown errors to `RpcError` — verify via e2e `test-server.spec.ts`
- [x] 4.2 Demo scenarios use new mock shapes; Canvas wires `onHostContextChanged` into a `replaceHostContext` store action — verify in `store.test.ts`
- [x] 4.3 Update e2e expectations (inspector shows `isError`, initialized in trace, no invalid rows) — verify `pnpm e2e`

## 5. Wrap-up

- [x] 5.1 Update CLAUDE.md constraint about follow-up messages and `config.yaml` context — verify by reading
- [x] 5.2 Run `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`; archive the change
