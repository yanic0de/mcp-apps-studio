# Tasks

## 1. Schema and adapter

- [x] 1.1 `scenarioSchema` with `toolCall` in `shared` (used by CLI define + manifest types) — verify in `mocks.test.ts` and `discover.test.ts`
- [x] 1.2 Adapter `pushHostEvent` for tool-input(-partial), tool-result, tool-cancelled — verify in `mcp-apps-adapter.test.ts`

## 2. Emulator

- [x] 2.1 Lifecycle push after `initialized` (partials, input, result/cancelled, failure → cancelled, no send after stop, no resend) — verify in `host-emulator.test.ts`
- [x] 2.2 `toolInfo` in the initialize result — verify in `host-emulator.test.ts`
- [x] 2.3 Conformance: official `App` receives `toolinput` and `toolresult` — verify in `sdk-conformance.test.ts`

## 3. Widget side

- [x] 3.1 `WidgetClient` lifecycle subscriptions — verify in `client.test.ts`
- [x] 3.2 `useToolLifecycle` reducer — verify in a node test of the pure reducer
- [x] 3.3 KPI reference widget renders from `tool-result`; inspector prints the lifecycle — verify via e2e

## 4. Studio

- [x] 4.1 `connectMcpServer` returns the linked tool — verify via e2e live tests
- [x] 4.2 Canvas passes `toolCall` (live defaults); demo and library stories declare `toolCall` — verify `pnpm e2e`

## 5. Wrap-up

- [x] 5.1 README story example shows `toolCall`; CLAUDE.md notes the lifecycle — verify by reading
- [x] 5.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`; archive
