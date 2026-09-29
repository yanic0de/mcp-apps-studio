# Proposal: fix-dev-loop-and-publishing

## Why

The first evaluation of the published `0.1.0` found six known bugs that users will hit in their first hour, plus two publishing gaps:

1. **Fixture edits are ignored.** A story that imports `./fixtures.json` or a `.ts` helper keeps serving the old data until the server restarts. The story is re-imported, but its imports stay in Node's module cache, and the watcher does not react to those files at all.
2. **The last deleted story stays on screen.** When every story is deleted, the studio keeps showing the last ones. The reload path treats an empty manifest as an error and silently drops it.
3. **Widget requests are invisible.** The studio shows open-link, message, model context, download, log and teardown requests only as raw trace rows. The host never sends `ui/resource-teardown` before removing a widget, which every real host does.
4. **Failures can escape silently.**
   - The bridge can raise unhandled promise rejections: a throwing notification handler, or a `postMessage` that fails to clone its data.
   - A failed `connectWidget` handshake leaves the context listener attached.
5. **The server can crash on a disappearing file.** When a studio asset disappears between the existence check and the read (for example during a rebuild), the CLI server crashes.
6. **Screenshots can land outside `--out`.** A scenario name with `/` or `..` becomes part of the screenshot path.

**Publishing:** `0.1.0` shipped without provenance, because pnpm ignores `NPM_CONFIG_PROVENANCE`. It was also published with a long-lived npm token.

## What Changes

- **Bundled stories.** Stories are bundled with esbuild: local imports are inlined and packages stay external. An edited fixture is therefore picked up on the next manifest request. Discovery reports each story's local dependencies, and the watcher reloads the studio when one of them changes.
- **Empty manifest on reload.** When a reload returns an empty manifest, the studio shows the built-in demo, exactly like a fresh start of an empty project.
- **Widget requests panel.** The studio lists the widget's host requests in human terms. Links are clickable only for `http(s)`, and open with `noopener`. The emulator gains `teardown()`: it sends `ui/resource-teardown`, waits up to 500 ms, then stops. The studio calls it before a widget is removed.
- **No unhandled failures.**
  - The bridge never produces an unhandled rejection. A failure while handling a message, or while sending one, becomes an `invalid` trace event.
  - `connectWidget` closes the `App` and removes its listeners when the handshake fails.
- **Static files.** Read errors answer `500` instead of crashing the server.
- **Screenshot paths.** Widget ids and scenario names are sanitized per segment (`[A-Za-z0-9._-]`, no `.`/`..` segments), so screenshots and baselines always stay under their directory.
- **Publishing.**
  - Both packages set `publishConfig.provenance: true`.
  - The release workflow publishes through npm Trusted Publishing (OIDC): `NPM_TOKEN` is no longer passed, `id-token: write` is kept, and `changesets/action` v1.9.0 detects OIDC by itself.
  - The npm side (a trusted publisher per package) is an owner step.
- **Release.** A patch changeset ships this as `0.1.1`.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cli`:
  - `Loading and validating a story`: bundling and dependencies.
  - `Watch and live events`: story dependencies trigger a reload.
  - New: `Resilient static serving`, `Safe artifact paths`.
- `studio-app`:
  - `Live reload`: an empty manifest shows the demo.
  - New: `Widget requests panel`, `Teardown before removal`.
- `host-emulator`: new `Resource teardown`.
- `json-rpc-bridge`: new `No unhandled failures`.
- `widget-runtime`: new `Failed handshake cleanup`.
- `distribution`: new `Trusted publishing with provenance`.

## Impact

- **Code:**
  - `packages/cli/src/{discover,watcher,bin,server,test-plan}.ts`
  - `apps/studio/src/{App.tsx,store.ts,components/Canvas.tsx}`, plus the new `apps/studio/src/intents.ts` and a small `HostRequests` component
  - `packages/host-emulator/src/{adapter,mcp-apps-adapter,host-emulator,message-bridge}.ts`
  - `packages/widget-runtime/src/session.ts`
  - `.github/workflows/release.yml`, both published `package.json` files
- **Owner steps:**
  - On npmjs.com, add a trusted publisher for each package: GitHub Actions, `yanic0de/mcp-apps-studio`, workflow `release.yml`.
  - Then delete the `NPM_TOKEN` secret and revoke the token.
