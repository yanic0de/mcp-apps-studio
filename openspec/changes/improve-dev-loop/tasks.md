# Tasks

## 1. Discovery and manifest

- [ ] 1.1 `WidgetManifestEntry` html | url; discovery: URL widgets, per-story errors, unique ids; `/api/manifest` → `{ widgets, errors }` — verify `discover.test.ts`, `server.test.ts`
- [ ] 1.2 `test` lists discovery errors and exits 1 — verify `test-plan.test.ts` summary + bin

## 2. Watch + events

- [ ] 2.1 `watcher.ts` (recursive fs.watch, filters, debounce) + `/api/events` SSE with auth — verify `watcher.test.ts`, `server.test.ts`
- [ ] 2.2 `mcp-apps-studio/vite` plugin + tsup entry/exports — verify `vite-plugin.test.ts`

## 3. Studio

- [ ] 3.1 Store `replaceWidgets` (keep selection, bump revision), errors banner, EventSource, dev-URL source in Canvas — verify `store.test.ts` + e2e (edit a story → widget updates)

## 4. Wrap-up

- [ ] 4.1 README dev-loop section; CLAUDE.md; changeset — verify by reading
- [ ] 4.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm smoke:pack`; archive
