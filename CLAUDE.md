# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP Apps Studio — a "fake host" for MCP widgets: everything a real host (Claude/ChatGPT) does to a widget (sandboxed iframe render, JSON-RPC bridge, theme/context, tool calls) is reproduced locally and made observable. Targets the MCP Apps extension (SEP-1865), pinned spec version `2026-01-26`.

## Commands

```bash
pnpm test                                  # all tests (vitest, single root config)
pnpm vitest run packages/host-emulator     # tests for one package/dir
pnpm vitest run packages/shared/src/json-rpc.test.ts -t 'classifies'  # single test
pnpm typecheck                             # tsc --noEmit per package via turbo
pnpm lint                                  # biome: format + lint + import order check (biome.json at root)
pnpm lint:fix                              # biome check --write (safe fixes only)
pnpm -F @studio/app dev                    # studio dev server (Vite), demo widget fallback
pnpm -F @studio/app build                  # studio production build
pnpm -F @studio/example-server dev         # reference MCP server on :3100 (live scenario default)
pnpm -F @studio/test-server dev            # test polygon MCP server on :3200 (echo/slow/fail/rows/counter + inspector widget)
pnpm -F mcp-apps-studio start [dir]        # CLI: serve built studio + discovered widgets (needs app build first)
pnpm -F @studio/components build           # bundle library widgets to dist/<name>.html (needed by their stories)
pnpm -F mcp-apps-studio start add <name>   # copy a registry component into a project (shadcn model)
pnpm e2e                                   # Playwright (chromium-only), spins up vite dev + example-server + CLI itself
```

Tests run in node (no jsdom): DOM-facing code is written against duck-typed interfaces (see `IframeTransport`) and tested with fakes. Test files sit next to source (`src/*.test.ts`), picked up by the root `vitest.config.ts`.

## Architecture

Monorepo (pnpm workspaces + turbo), all ESM. Packages export TS source directly (`"exports": "./src/index.ts"`) — no build step yet; publish story deferred.

Layering (dependencies point down, never up):

- `apps/studio` (`@studio/app`) — React 19 + Zustand SPA. Zustand holds ephemeral UI state only (host context, scenario, RPC log); anything that would survive a reload belongs to TanStack Query later. Canvas remounts iframe + emulator per scenario via `key={scenario}`. `src/adapter.ts` holds the single `HostAdapter` instance: Canvas renders the iframe from `adapter.buildIframeEnv()`, HeaderControls takes display modes from `adapter.capabilities()` and theme options from `hostContextSchema` — never hand-copy these. The `vite dev` fallback widget is the example-server's `kpi-card.html` imported via `?raw` (one source, no studio copy).
- `packages/host-emulator` — DOM-free core plus one DOM edge:
  - `MessageBridge` — JSON-RPC 2.0 over an abstract `Transport`; validates EVERY incoming message with zod before dispatch (widgets are untrusted code), correlates request ids, timeouts, emits `RpcLogEvent`s.
  - `HostAdapter` (`adapter.ts`) — PURE translator: wire message → semantic `AdapterAction`, host event → wire notification. No transport access, no side effects — this is what makes adapters testable against golden logs and lets a future `openai-apps` adapter slot in. Actions carry no request id (the bridge answers with the original request's id). `McpAppsAdapter` is the only implementation.
  - `MockRouter` — resolves tool calls from `MockConfig` (static/error/delay/passthrough); passthrough handler is the future hook for a real MCP client.
  - `HostEmulator` — composes bridge + adapter + mocks + resources; the only stateful orchestrator. Widget intents (open-link, message, model context, download, log, teardown request) go out through `onWidgetIntent`; widget-initiated context changes (display mode) through `onHostContextChanged`. A scenario's `toolCall` is played after `ui/notifications/initialized` (tool-input-partial* → tool-input once → tool-result | tool-cancelled); `toolInfo` goes only into the initialize result, never into the shared context.
  - `IframeTransport` — the DOM edge. Sandboxed widgets have a null origin, so `event.source === iframe.contentWindow` is the ONLY trust signal; never weaken this check or add `allow-same-origin`.
- `packages/shared` — zod schemas + types + protocol constants, plus the two runtime pieces both sides of the bridge need: `RpcError` and `RequestTracker` (request id allocation, timeout, settlement — used by `MessageBridge` on the host and `WidgetClient` in the widget; do not reimplement pending-request maps). `protocol.ts` is the single source of truth for SEP-1865 wire method names; when the spec evolves, change it there only.
- `packages/cli` (`mcp-apps-studio`) — walks a user project for `*.stories.mcp.ts` (story = default-exported config; `defineWidgetStory` is a typed identity), transpiles each story with esbuild and imports a temp `.mjs` written NEXT to the story (so its imports resolve from the user's project), serves the built studio over `node:http` with `/api/manifest`. Binds 127.0.0.1 ONLY; every request needs the one-time token (query once → HttpOnly cookie), compared timing-safe — do not weaken (MCPJam Inspector RCE lesson).
- `packages/example-server` (`@studio/example-server`) — reference MCP Apps server on the public SDKs, intentionally free of workspace deps (living documentation). Its `kpi-card.html` is also the studio's demo widget (exported as `./kpi-card.html`), so edit it in one place. Studio's `live` scenario connects to ANY MCP server: URL from the `?server=` query param (default :3100), widget discovered via `resources/list` by mime `text/html;profile=mcp-app`, tool calls proxied via the MockRouter passthrough hook.
- `packages/test-server` (`@studio/test-server`) — test polygon (also workspace-dep-free): one tool per emulator behavior (`echo`, `slow_metrics`, `fail` → isError, `get_rows` pagination, `counter` module-level state surviving stateless per-request instances) + vanilla "Protocol Inspector" widget with a button per tool. Use with `?server=http://localhost:3200/mcp`.
- `packages/widget-runtime` (`@studio/widget-runtime`) — the ONLY sanctioned widget↔host channel: `WidgetClient` (duck-typed `WidgetWindow`, node-testable; failed calls reject with `RpcError`, re-exported here), `applyHostContextToDocument`, React hooks under the `./react` subpath (main entry must stay react-free for vanilla widgets).
- `packages/components` (`@studio/components`) — source-distributed library (shadcn model). Component contract: theming only via `--widget-*` CSS variables (+ `[data-theme='dark']`), a text-only fallback function per component, a `*.stories.mcp.ts` with default/loading|empty/error scenarios, no direct `window.parent`. `build.mjs` bundles each widget to a self-contained `dist/<name>.html` (vite + singlefile, target es2022 — entries use top-level await); stories point at dist, so build before serving the library in the studio. `registry.json` is the static index consumed by `mcp-apps-studio add`.

## Constraints that are easy to violate

- Protocol ground truth is the installed `@modelcontextprotocol/ext-apps` SDK (`dist/src/spec.types.d.ts`), never memory. `packages/host-emulator/src/sdk-conformance.test.ts` drives the official `App` against `HostEmulator`; a new wire method goes into `protocol.ts` and gets a conformance case.
- `tools/call` answers a full MCP `CallToolResult` (mock and live alike); tool failures are `isError` results, JSON-RPC errors are only for protocol failures (`rpc-error` mock kind).
- Deliberate MVP cuts (do not "helpfully" add): server-api backend, docs site, openai/legacy adapters, Tailwind, changesets. Registry is static JSON, sessions go to localStorage, traces live in the Zustand log.
- E2E (`e2e/`, Playwright) is chromium-only by design; the CLI web server rebuilds app+components each run and uses the `--token` bin flag (automation-only) so tests can authenticate.
- CSP emulation via the iframe `csp` attribute only works in Chromium — treat CSP checks as Chromium-only.
- Core packages must stay runnable in node: no direct `window`/DOM globals outside `IframeTransport` (which takes an injectable `ListeningWindow`).

## Workflow

Specifications live in `openspec/` (OpenSpec format): `specs/<capability>/spec.md` is what IS built, `changes/<id>/` is what SHOULD change. Planning context and artifact rules live in `openspec/config.yaml`; the workflow is the `/opsx:*` commands (`propose` → `apply` → `archive`, skills in `.claude/skills/openspec-*`). Run `pnpm openspec validate --all --strict` after every edit under `openspec/`, and keep specs in sync with behavior changes. Implementation plans live in `docs/superpowers/plans/` (checkbox format, one per phase). TDD per task: failing test → implement → `pnpm lint` → commit. Suppress a Biome rule only with a `biome-ignore` comment that states the reason (see `Canvas.tsx`, `DataTable.tsx`). MVP roadmap complete: core → studio → example-server → CLI → widget-runtime/components/registry → e2e. Candidate next steps: publish story (build + changesets), openai-apps adapter, design brief (see memory).
