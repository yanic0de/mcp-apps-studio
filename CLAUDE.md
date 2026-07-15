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
pnpm -F @studio/app dev                    # studio dev server (Vite), demo widget fallback
pnpm -F @studio/app build                  # studio production build
pnpm -F @studio/example-server dev         # reference MCP server on :3100 (live scenario)
pnpm -F mcp-apps-studio start [dir]        # CLI: serve built studio + discovered widgets (needs app build first)
pnpm -F @studio/components build           # bundle library widgets to dist/<name>.html (needed by their stories)
pnpm -F mcp-apps-studio start add <name>   # copy a registry component into a project (shadcn model)
```

Tests run in node (no jsdom): DOM-facing code is written against duck-typed interfaces (see `IframeTransport`) and tested with fakes. Test files sit next to source (`src/*.test.ts`), picked up by the root `vitest.config.ts`.

## Architecture

Monorepo (pnpm workspaces + turbo), all ESM. Packages export TS source directly (`"exports": "./src/index.ts"`) — no build step yet; publish story deferred.

Layering (dependencies point down, never up):

- `apps/studio` (`@studio/app`) — React 19 + Zustand SPA. Zustand holds ephemeral UI state only (host context, scenario, RPC log); anything that would survive a reload belongs to TanStack Query later. Canvas remounts iframe + emulator per scenario via `key={scenario}`.
- `packages/host-emulator` — DOM-free core plus one DOM edge:
  - `MessageBridge` — JSON-RPC 2.0 over an abstract `Transport`; validates EVERY incoming message with zod before dispatch (widgets are untrusted code), correlates request ids, timeouts, emits `RpcLogEvent`s.
  - `HostAdapter` (`adapter.ts`) — PURE translator: wire message → semantic `AdapterAction`, host event → wire notification. No transport access, no side effects — this is what makes adapters testable against golden logs and lets a future `openai-apps` adapter slot in. `McpAppsAdapter` is the only implementation.
  - `MockRouter` — resolves tool calls from `MockConfig` (static/error/delay/passthrough); passthrough handler is the future hook for a real MCP client.
  - `HostEmulator` — composes bridge + adapter + mocks + resources; the only stateful orchestrator.
  - `IframeTransport` — the DOM edge. Sandboxed widgets have a null origin, so `event.source === iframe.contentWindow` is the ONLY trust signal; never weaken this check or add `allow-same-origin`.
- `packages/shared` — zod schemas + types + protocol constants. `protocol.ts` is the single source of truth for SEP-1865 wire method names; when the spec evolves, change it there only.
- `packages/cli` (`mcp-apps-studio`) — walks a user project for `*.stories.mcp.ts` (story = default-exported config; `defineWidgetStory` is a typed identity), transpiles each story with esbuild and imports a temp `.mjs` written NEXT to the story (so its imports resolve from the user's project), serves the built studio over `node:http` with `/api/manifest`. Binds 127.0.0.1 ONLY; every request needs the one-time token (query once → HttpOnly cookie), compared timing-safe — do not weaken (MCPJam Inspector RCE lesson).
- `packages/example-server` (`@studio/example-server`) — reference MCP Apps server on the public SDKs, intentionally free of workspace deps (living documentation). Studio's `live` scenario reads its `ui://` widget and proxies tool calls to it via the MockRouter passthrough hook.
- `packages/widget-runtime` (`@studio/widget-runtime`) — the ONLY sanctioned widget↔host channel: `WidgetClient` (duck-typed `WidgetWindow`, node-testable), `applyHostContextToDocument`, React hooks under the `./react` subpath (main entry must stay react-free for vanilla widgets).
- `packages/components` (`@studio/components`) — source-distributed library (shadcn model). Component contract: theming only via `--widget-*` CSS variables (+ `[data-theme='dark']`), a text-only fallback function per component, a `*.stories.mcp.ts` with default/loading|empty/error scenarios, no direct `window.parent`. `build.mjs` bundles each widget to a self-contained `dist/<name>.html` (vite + singlefile, target es2022 — entries use top-level await); stories point at dist, so build before serving the library in the studio. `registry.json` is the static index consumed by `mcp-apps-studio add`.

## Constraints that are easy to violate

- Widget follow-up messages are intentionally NOT in the adapter: the wire method name was unconfirmed in spec `2026-01-26`. Add only against the real `@modelcontextprotocol/ext-apps` SDK, not from memory.
- Deliberate MVP cuts (do not "helpfully" add): server-api backend, docs site, Playwright e2e, openai/legacy adapters, Tailwind, changesets. Registry is static JSON, sessions go to localStorage, traces live in the Zustand log.
- CSP emulation via the iframe `csp` attribute only works in Chromium — treat CSP checks as Chromium-only.
- Core packages must stay runnable in node: no direct `window`/DOM globals outside `IframeTransport` (which takes an injectable `ListeningWindow`).

## Workflow

Implementation plans live in `docs/superpowers/plans/` (checkbox format, one per phase). TDD per task: failing test → implement → commit. MVP roadmap complete: core → studio → example-server → CLI → widget-runtime/components/registry. Candidate next steps: publish story (build + changesets), Playwright e2e, openai-apps adapter, design brief (see memory).
