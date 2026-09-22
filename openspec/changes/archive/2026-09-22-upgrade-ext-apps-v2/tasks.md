# Tasks

## 1. Dependencies

- [x] 1.1 Replace `@modelcontextprotocol/sdk` with SDK v2 packages and bump ext-apps to ^2 in every package.json; widget-runtime peers — verify `pnpm install` has no peer warnings for our packages

## 2. Code

- [x] 2.1 widget-runtime type imports from `@modelcontextprotocol/client`; tsup externals — verify widget-runtime tests
- [x] 2.2 example-server/test-server on the v2 server stack (server, main, tests) — verify their tests
- [x] 2.3 studio live client on `@modelcontextprotocol/client` — verify live e2e
- [x] 2.4 Conformance test on ext-apps 2 — verify `sdk-conformance.test.ts`

## 3. Verification

- [x] 3.1 Docs, `add` hint, pack smoke peers (install latest, no pinned 1.x) — verify `pnpm smoke:pack`
- [x] 3.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`; changeset; archive
