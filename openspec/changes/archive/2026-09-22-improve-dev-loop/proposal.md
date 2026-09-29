# Proposal

## Why

The positioning promises a Storybook-grade loop, but today every change means rebuilding the widget bundle and refreshing the browser, and one story with a typo takes the whole manifest down (HTTP 500). Two basenames alike (`a/card.stories.mcp.ts`, `b/card.stories.mcp.ts`) silently collide on one id. Widgets are usually built with Vite; they should run straight from the dev server with HMR inside the same null-origin sandbox a real host uses.

## What Changes

- A story's `widget` may be an `http(s)://` URL (a dev server); the studio then renders the iframe from that URL (`src`) with the same sandbox. The headless `test` command works with it too.
- `mcp-apps-studio/vite`: a Vite plugin that lets the dev server serve null-origin sandboxed iframes (CORS origin `null`, needed for module scripts and the HMR socket). Measured: without it Vite 6 blocks `/@vite/client` from the sandbox.
- Watch mode: the CLI watches the project for story and widget HTML changes and pushes a `manifest` event over Server-Sent Events (`/api/events`, same token rules); the studio reloads the manifest, keeps the selected widget/scenario when they still exist, and remounts the widget.
- Discovery isolates failures: a broken story becomes an entry in `errors: [{ file, message }]` next to the working `widgets`; the studio shows them in a banner; `test` fails when there are errors.
- Widget ids are unique: the story basename, or the story path relative to the project root when basenames collide.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cli`: URL widgets, per-story errors in the manifest, unique ids, watch + SSE, Vite plugin export.
- `studio-app`: dev-URL widgets, live reload on manifest events, discovery error banner.

## Impact

- Code: `packages/shared` (manifest types), `packages/cli` (discover, server, bin, vite plugin, tsup entry), `apps/studio` (App, Canvas, store), e2e.
- Security: the Vite plugin widens the dev server's CORS to `null` origins — opt-in and documented; the studio server's SSE endpoint keeps localhost + token.
