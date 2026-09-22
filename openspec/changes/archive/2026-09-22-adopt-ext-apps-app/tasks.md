# Tasks

## 1. Test harness

- [x] 1.1 `toMcpTransport(end)` in host-emulator (structural MCP transport); conformance test uses it — verify `sdk-conformance.test.ts`

## 2. widget-runtime on the SDK

- [x] 2.1 `createToolLifecycleStore(app)` — verify against HostEmulator in `lifecycle-store.test.ts` (early result captured, unsubscribe)
- [x] 2.2 `connectWidget` (record before connect, document applier, default transport) — verify `connect.test.ts` against HostEmulator
- [x] 2.3 React: `WidgetProvider session`, `useWidgetApp`, `useHostContext`, `useToolCall`, `useToolLifecycle` — verify SSR + provider tests
- [x] 2.4 Remove `WidgetClient`, `dom.ts`, `RpcError` re-export, `@studio/shared` dep; add SDK deps — verify `pnpm typecheck`

## 3. Components

- [x] 3.1 Entries use `connectWidget` with auto-resize; tests render with a session — verify `pnpm vitest run packages/components`
- [x] 3.2 Build and compare bundle size — record in the commit message
- [x] 3.3 e2e: library component dark theme sets `data-theme`, trace has `initialized` — verify `pnpm e2e`

## 4. Wrap-up

- [x] 4.1 CLAUDE.md, README, config.yaml describe widget-runtime as SDK extras — verify by reading
- [x] 4.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `studio test` on components; archive
