# Project Context

## Purpose

MCP Apps Studio is a "fake host" for MCP widgets. Everything a real host (Claude, ChatGPT) does to a widget — sandboxed iframe render, JSON-RPC bridge, theme and context delivery, tool calls — is reproduced locally and made observable. A widget developer sees every message in the trace and switches scenarios (mocks, delays, errors), themes and display modes without a real host.

Target specification: the MCP Apps extension (SEP-1865), protocol version `2026-01-26`.

## Tech Stack

- TypeScript 5.8 (`strict`, `noUncheckedIndexedAccess`), ESM everywhere.
- Monorepo: pnpm workspaces + turbo. Packages export TS source directly (`"exports": "./src/index.ts"`); no build step yet, the publish story is deferred.
- Validation: zod 4. Schemas are the single source for both types and runtime checks.
- Studio: React 19 + Zustand + Vite.
- Tests: vitest in Node (no jsdom); Playwright for e2e (chromium only).
- Formatting and linting: Biome (`biome.json` at the root).
- Example servers: `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps` + express.

## Structure and Layers

Dependencies point down only:

| Layer | Package | Role |
|---|---|---|
| application | `apps/studio` (`@studio/app`) | Studio SPA: canvas, controls, trace |
| tool | `packages/cli` (`mcp-apps-studio`) | story discovery, local studio server, `add` |
| host core | `packages/host-emulator` | bridge, adapter, mock router, emulator, iframe transport |
| widget side | `packages/widget-runtime` | the only sanctioned widget ↔ host channel |
| library | `packages/components` | source-distributed components (shadcn model) |
| shared | `packages/shared` | schemas, types, protocol constants, `RpcError`, `RequestTracker` |
| reference servers | `packages/example-server`, `packages/test-server` | no workspace deps; living documentation and a test polygon |

Capability specs live in `openspec/specs/<capability>/spec.md`, one per table row (plus `protocol` and `tool-mocks`).

## Conventions

- **TDD per task:** failing test → implementation → `pnpm lint` → commit. Tests sit next to source (`src/*.test.ts`).
- **The core runs in Node.** No `window`/`document` outside `IframeTransport` (takes an injectable `ListeningWindow`) and default parameters in `widget-runtime`. DOM-facing code is written against duck-typed interfaces and tested with fakes.
- **The widget is untrusted code.** Every incoming message passes zod before dispatch.
- **One source of truth.** Wire method names live only in `packages/shared/src/protocol.ts`. The list of mock kinds lives only in `toolMockSchema`. UI options for theme and display mode come from `hostContextSchema` and `adapter.capabilities()`, never hand-copied.
- **Do not reinvent.** Request correlation (id, timeout, settle) is only `RequestTracker`. Bridge errors are only `RpcError`.
- **Suppressing Biome rules** is allowed only with a `biome-ignore` comment stating the reason.
- **Commits:** conventional commits (`feat|fix|refactor|chore|style(scope): ...`).

## Constraints That Are Easy to Violate

- Widget follow-up messages are intentionally NOT implemented in the adapter: the wire method name is unconfirmed in spec `2026-01-26`. Add only against the real `@modelcontextprotocol/ext-apps` SDK, never from memory.
- Deliberate MVP cuts (do not "helpfully" add): server-api backend, docs site, openai/legacy adapters, Tailwind, changesets. The registry is static JSON, sessions go to localStorage, traces live in the Zustand log.
- CLI security: `127.0.0.1` only, a token on every request, constant-time comparison, path traversal blocked. Do not weaken (the MCPJam Inspector RCE lesson).
- Sandbox: `allow-scripts` only. Never add `allow-same-origin`. The only trust signal for a message is `event.source === iframe.contentWindow`.
- CSP emulation via the iframe `csp` attribute works only in Chromium.

## Glossary

- **Host** — the application that shows the widget (Claude, ChatGPT); here `HostEmulator` plays that role.
- **Widget** — an HTML document rendered in a sandboxed iframe, talking to the host over JSON-RPC 2.0 via `postMessage`.
- **Adapter** — a pure translator between wire messages and semantic actions, and back. One per protocol dialect.
- **Story** — a `*.stories.mcp.ts` file whose default export is `{ title, widget, scenarios }`; describes a widget and its scenarios for the studio.
- **Scenario** — a named set of tool mocks. The `live` scenario with no mocks means proxying to a real MCP server.
- **Mock** — the emulator's answer to `tools/call`: `static`, `error` or `passthrough`.
- **Manifest** — the list of widgets (`WidgetManifestEntry[]`) the CLI serves to the studio at `/api/manifest`.
- **Trace** — the log of `RpcLogEvent`s in both directions, including invalid messages.
