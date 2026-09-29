# Tasks

## 1. Story dependencies

- [x] 1.1 `discover.ts`: bundle with esbuild (`packages: 'external'`, metafile), return `dependencies`; server serializes only `{ widgets, errors }` — verify `discover.test.ts` (edited JSON fixture is picked up, dependencies list it; temp files removed) and `server.test.ts`
- [x] 1.2 `watcher.ts` + `bin.ts`: `isDependency` predicate from the latest discovery — verify `watcher.test.ts` (fixture relevant, unrelated `.ts` not)

## 2. Studio

- [x] 2.1 `widgetsForManifest` used by first load and reload (empty → demo) — verify `manifest.test.ts`
- [x] 2.2 `intents.ts` `describeIntent` + store `intents` (cap 50, cleared with log) + `HostRequests` list under the canvas — verify `intents.test.ts`, `store.test.ts`
- [x] 2.3 Adapter `buildHostRequest`, `HostEmulator.teardown()`, Canvas cleanup through it — verify `host-emulator.test.ts` (silent widget → timeout, before handshake → nothing sent) and a `sdk-conformance.test.ts` case (`onteardown` runs)

## 3. Robustness

- [x] 3.1 `MessageBridge`: no unhandled rejections; send failures logged as `invalid` — verify `message-bridge.test.ts` (throwing handler, throwing send on response and notify)
- [x] 3.2 `connectWidget` cleanup on failed connect — verify `session.test.ts` (start rejects → rejects with it, transport closed)
- [x] 3.3 Server read-stream errors → 500 via an `openFile` seam — verify `server.test.ts`
- [ ] 3.4 `safeSegment` in `buildTestPlan` — verify `test-plan.test.ts` (traversal scenario name stays inside)

## 4. Publishing

- [ ] 4.1 `publishConfig.provenance: true` in both packages; `release.yml` without `NPM_TOKEN`/`NODE_AUTH_TOKEN`/`registry-url`; tests in `package-meta.test.ts` and `workflows.test.ts`; CONTRIBUTING release checklist (trusted publishers first) — verify tests
- [ ] 4.2 Patch changeset; README note on path aliases in stories; CLAUDE.md/ARCHITECTURE updates — verify by reading the diff

## 5. Wrap-up

- [ ] 5.1 `pnpm openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm smoke:pack` all green
