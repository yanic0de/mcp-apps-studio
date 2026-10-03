# Design

## Context

- **Discovery.** It uses esbuild `transform` on the story alone and imports the result. Anything the story imports goes through Node's ESM loader, which caches modules for the life of the process.
- **Watcher.** It knows two suffixes: `.stories.mcp.ts` and `.html`.
- **Studio.** The Canvas creates one `HostEmulator` per iframe. Its effect cleanup calls `stop()` and `transport.dispose()` synchronously.
- **Publishing.** `changesets/action` v1.9.0 writes `~/.npmrc` from `NPM_TOKEN` when that variable is set. Otherwise it detects OIDC (`ACTIONS_ID_TOKEN_REQUEST_*`) and lets the publisher exchange it. pnpm 12 implements Trusted Publishing and `publishConfig.provenance` natively.

## Goals / Non-Goals

**Goals:**
- Fixture edits and deletions behave the way a user expects from a dev server.
- No crash or silent failure paths in the studio's bridge, the widget runtime or the CLI server.
- `0.1.1` is published with provenance and without a long-lived token.

**Non-Goals:**
- Memory growth from importing a new temporary module per manifest request. That needs a worker or VM-based loader and is a separate change.
- Temporary files left behind after a hard kill. That is part of the same future loader change.
- Actually opening links or delivering messages. The studio is a fake host: it shows requests and never acts on them automatically.
- The capped-trace issue in `record.ts`.

## Decisions

- **Bundle, don't bust the cache.**
  - `esbuild.build({ bundle: true, packages: 'external', format: 'esm', platform: 'node', write: false, metafile: true })`.
  - Local files, including JSON, end up inside the temporary module. That module has a fresh URL each time, so every discovery sees current fixture data.
  - Package imports stay external and still resolve from the project, because the temporary file sits next to the story.
  - The dependency list comes from `metafile.inputs`, resolved against `absWorkingDir`.
  - Considered and rejected: query-string cache busting (`?v=`) for each import. Only the entry module would be busted, not its transitive imports.
- **Dependencies go to the watcher, not into the manifest JSON.**
  - `discoverStories` returns `{ widgets, errors, dependencies }`.
  - The server serializes only `{ widgets, errors }`, because absolute paths are not the page's business.
  - `bin` keeps the latest dependency set in a closure. `watchProject` gets an `isDependency(absPath)` predicate next to the fixed suffix rule.
- **An empty reload maps to the demo.** One pure function, `widgetsForManifest(manifest)`, is used by both the first load and a reload: no widgets means `[demoWidget]`. `loadManifest` stops treating an empty manifest as an error when the response is a real JSON manifest.
- **Intents live in the store, described by a pure helper.**
  - The store gets `intents: { seq, intent }[]`, capped at 50 and cleared together with the log.
  - `describeIntent(intent) → { kind, text, href? }` in `apps/studio/src/intents.ts` is pure and unit-tested. `href` is set only for `http:`/`https:`.
  - A `HostRequests` list renders under the canvas when it is not empty.
- **Teardown.**
  - `HostAdapter.buildHostRequest({ type: 'teardown' })` returns `{ method, params }`, so the adapter stays the single place for wire names.
  - `HostEmulator.teardown()` races `bridge.request` against a timer and always ends with `stop()`. Rejections are swallowed: after a stop the tracker rejects pending requests, and a widget may answer with an error.
  - Canvas cleanup becomes `void emulator.teardown().finally(() => transport.dispose())`.
  - The iframe is removed by React right after the cleanup, so on a switch the widget usually cannot answer. The conformance test covers the reply path with the real SDK.
- **Bridge safety.**
  - `start()` wraps `handleIncoming(raw)` in `.catch(logInternal)`.
  - `handleRequest` and `notify` wrap `transport.send` in `try/catch`.
  - `logInternal` records `{ kind: 'invalid', error: 'host failed to …: <message>' }`.
- **`connectWidget` cleanup.** On a `connect()` rejection it removes the `hostcontextchanged` listener, runs `await app.close().catch(() => {})`, and rethrows.
- **Static serving.**
  - `createReadStream(filePath).on('error', …)`: answer `500` if headers are not sent yet, otherwise destroy the response.
  - Tested by serving a path whose stream fails: a directory disguised by a race is hard to reproduce, so the test uses an injected `openFile` seam, a tiny optional server option that defaults to `fs.createReadStream`.
- **Safe paths.** `safeSegment(s)` replaces anything outside `[A-Za-z0-9._-]` with `_`. A result of `.` or `..` becomes `_`. `buildTestPlan` applies it per `/`-separated segment of the widget id and to the scenario name.
- **Trusted Publishing.**
  - `release.yml` drops `NPM_TOKEN`, `NODE_AUTH_TOKEN` and `NPM_CONFIG_PROVENANCE` from the changesets step, and drops `registry-url` from `setup-node`. The `.npmrc` that option writes refers to `NODE_AUTH_TOKEN`, and a stale token config would override the OIDC exchange.
  - Both manifests get `publishConfig.provenance: true`.
  - `workflows.test.ts` and `package-meta.test.ts` guard both.

## Risks / Trade-offs

- [Trusted publisher not configured on npm before the next release → publish fails] → the release workflow still runs every check first. The failure is loud and happens before anything is published. CONTRIBUTING puts "configure trusted publishers, then delete `NPM_TOKEN`" at the top of the release checklist.
- [Bundling changes semantics for stories with side-effecting local imports, such as reading files at import time] → rare in story files, and the behavior matches what the story gets today, just evaluated fresh.
- [`packages: 'external'` treats path aliases (`@/fixtures`) as packages] → they resolve as before from the project. They are not inlined, so their edits still need a restart. This is documented.
- [Teardown adds up to 500 ms before the transport is disposed] → the new iframe is created independently, so no visible delay.

## Migration Plan

No user migration. The owner configures trusted publishers for both packages before merging the "Version Packages" PR for `0.1.1`, then deletes the `NPM_TOKEN` secret and revokes the token.
