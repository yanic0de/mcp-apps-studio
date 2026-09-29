# Design

## Context

Experiment (Vite 6.4, Chromium): a `sandbox="allow-scripts"` iframe pointing at a Vite dev server fails with CORS errors for `/@vite/client` and inline module proxies (origin `null`). With `server.cors = { origin: 'null' }` the modules load, the HMR socket connects and a file change reloads the frame. The adapter already supports `{ kind: 'dev', url }` → iframe `src`.

## Goals / Non-Goals

**Goals:** edit a widget or a story and see it in the studio without touching the browser; one broken story never hides the others.

**Non-Goals:** HMR for bundled `dist` HTML (reload is enough); watching remote dev servers (their own HMR handles it); a webpack plugin.

## Decisions

1. **URL widgets are not fetched by the CLI**: the manifest carries `url` instead of `html`; the iframe loads it directly so the dev server's HMR client runs. `WidgetManifestEntry` becomes `{ html } | { url }`.
2. **Vite plugin, not documentation**: `mcpAppsStudio()` merges `server.cors.origin` to include `'null'` (keeping user origins). One import instead of a subtle CORS recipe.
3. **SSE over WebSocket**: one-way, works through the existing `node:http` server and cookie auth, `EventSource` reconnects by itself. Events are debounced (100 ms).
4. **`fs.watch(root, { recursive: true })`** filtered to `*.stories.mcp.ts` and `*.html`, ignoring `node_modules`, dot-dirs and the CLI's own temp `.story-*.mjs` files (they would retrigger discovery).
5. **Errors in the manifest, not HTTP 500**: `{ widgets, errors }`; `500` stays only for unexpected failures outside story loading.
6. **Ids**: basename when unique, else the relative path without the suffix (`a/card`), computed after all stories are known.
7. **Studio reload keeps state**: after a `manifest` event the store replaces widgets, keeps `activeWidgetId`/`scenario` if present, and bumps `revision`, which is part of the iframe key.

## Risks / Trade-offs

- [CORS `null` lets any sandboxed page read the dev server] → opt-in plugin, dev server only, documented.
- [Recursive `fs.watch` differences across OSes] → Node ≥ 20 supports recursive watch on Linux/macOS/Windows; failures to start watching are logged, not fatal.
