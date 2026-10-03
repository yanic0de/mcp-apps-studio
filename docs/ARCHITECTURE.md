# Architecture

MCP Apps Studio is a **fake host** for MCP Apps widgets. Everything a real host (Claude, ChatGPT) does to a widget is reproduced locally and made observable:

- render it in a sandboxed iframe;
- speak JSON-RPC over `postMessage`;
- deliver the theme and host context;
- answer tool calls.

The protocol is the MCP Apps extension (SEP-1865), spec version `2026-01-26`.

```
                 apps/studio (React)                    your MCP server
   ┌──────────────────────────────────────────┐        ┌───────────────┐
   │ Canvas ── iframe[sandbox=allow-scripts]  │  live  │ tools/call    │
   │   │        ▲            │ postMessage    │ ◄────► │ resources/read│
   │   ▼        │            ▼                │        └───────────────┘
   │ IframeTransport ── MessageBridge ── HostAdapter (mcp-apps)
   │                       │                 ▲
   │                  HostEmulator ── MockRouter ── passthrough
   │                       │
   │                  RPC trace ── Zustand ── TracePanel
   └──────────────────────────────────────────┘
        ▲ /api/manifest, /api/events (SSE)
   packages/cli: story discovery, token-protected 127.0.0.1 server, `test` via playwright-core
```

## Packages

Dependencies point down only.

| Package | Role |
|---|---|
| `apps/studio` (`@studio/app`) | The studio SPA (React 19 + Zustand): canvas, controls, trace panel. Zustand holds only ephemeral UI state. |
| `packages/cli` (`mcp-apps-studio`, **published**) | Story discovery, the local server, `test`, `init`, `add`, `install-browser`, and the Vite plugin. It bundles every `@studio/*` package and the built studio. |
| `packages/host-emulator` | The host core, which runs in Node: bridge, adapter, mock router and emulator. `IframeTransport` is its only DOM edge. |
| `packages/widget-runtime` (`@mcp-apps-studio/widget-runtime`, **published**) | Helpers on top of the official ext-apps `App`: `connectWidget` and React hooks. It has no protocol code of its own. |
| `packages/shared` | Zod schemas, protocol constants (`protocol.ts` is the single source of wire method names), `RpcError`, `RequestTracker`. |
| `packages/components` | The widget library (`kpi-card`, `data-table`), distributed as source (shadcn model) through `registry.json`. |
| `packages/example-server`, `packages/test-server` | Reference MCP servers, with no workspace dependencies: `example-server` is living documentation, and `test-server` has one tool per host behavior. |

## Host core

- **`MessageBridge`** speaks JSON-RPC 2.0 over an abstract `Transport`. It validates **every** incoming message with zod before dispatch, because widgets are untrusted code. It also correlates request ids with timeouts and emits trace events.
- **`HostAdapter`** is a *pure* translator: a wire message becomes a semantic action, and a host event becomes a wire notification. It has no transport and no side effects, which is what makes it testable and lets a second dialect (the OpenAI Apps SDK) slot in. `McpAppsAdapter` is the only implementation today.
- **`MockRouter`** answers `tools/call` from the scenario's mocks: `static`, `error` (an `isError` result), `rpc-error` (a protocol error), `delayMs`, or `passthrough` to a real server.
- **`HostEmulator`** composes the pieces above and is the only stateful orchestrator:
  - It sends host context changes only after the handshake.
  - It plays a scenario's `toolCall` after `ui/notifications/initialized` (`tool-input-partial`* → `tool-input` → `tool-result` | `tool-cancelled`).
  - It reports widget intents (open-link, message, …) to the embedder; the studio lists them and never acts on them by itself.
  - `teardown()` sends `ui/resource-teardown`, waits for the answer (at most 500 ms) and stops. The studio calls it before removing a widget, as real hosts do.
- **`IframeTransport`** is the DOM edge. A sandboxed widget has a `null` origin, so `event.source === iframe.contentWindow` is the **only** trust signal.

## Trust model

| Boundary | Rule |
|---|---|
| Widget ↔ studio | The iframe gets `sandbox="allow-scripts"`, never `allow-same-origin`. Messages count only when they come from that frame, and each is validated before dispatch. |
| Browser ↔ CLI server | The server binds to `127.0.0.1` only. A one-time 128-bit token is required on every request (in the query once, then in an `HttpOnly`, `SameSite=Strict` cookie) and compared in constant time. Static serving is traversal-safe. |
| User project ↔ CLI | Stories are code: they are transpiled with esbuild and imported. The CLI never runs anything else from the project. |
| CI ↔ Action | Inputs reach shell steps only through `env:`. Actions are pinned by commit SHA. |

## `mcp-apps-studio test`

1. Discover stories and build the plan: widget × non-`live` scenario × theme.
2. Serve the studio on an ephemeral port and launch headless Chromium (`playwright-core`).
3. For each run, `executeRun` (`run-executor.ts`) does the following, and never throws: a crash becomes a failed result.
   1. Open a deep link (`?widget=&scenario=&theme=`).
   2. Wait for the handshake.
   3. Check that the studio rendered that target (`window.__mcpStudio.getActive()`).
   4. Play the scenario's `steps`, if any. Actions go through `RunPage.act`, which uses Playwright's frame locator on the sandboxed iframe; the sandbox is untouched. Expectations poll the read-only trace, and each consumes the earliest matching widget message (pure logic in `steps.ts`). The first failure stops the steps.
   5. Evaluate the trace: the handshake is complete and no message is invalid.
   6. Take a screenshot and compare it with the baseline, or write the baseline (passing runs only).
4. Write `report.json`, `report.html` and the GitHub job summary.

## Constraints that are easy to violate

- The protocol ground truth is the installed `@modelcontextprotocol/ext-apps` SDK (`dist/src/spec.types.d.ts`), never memory. `sdk-conformance.test.ts` drives the official `App` against `HostEmulator`. A new wire method goes into `protocol.ts` and gets a conformance case.
- `tools/call` always answers a full MCP `CallToolResult`. Tool failures are `isError` results. JSON-RPC errors are only for protocol failures.
- Core packages must run in Node: no `window` or DOM globals outside `IframeTransport`.
- Request correlation is only `RequestTracker`, and bridge errors are only `RpcError`. Do not reinvent them.
- The MCP stack is ext-apps 2.x on MCP SDK v2. `@modelcontextprotocol/sdk` (v1) must not come back.
- CSP emulation through the iframe `csp` attribute works only in Chromium.

## Tests

- **Unit tests** use vitest in Node (no jsdom) and sit next to the source. DOM-facing code is written against duck-typed interfaces and tested with fakes.
- **SDK conformance** runs the official ext-apps `App` against `HostEmulator`.
- **E2E** tests (Playwright, Chromium only, in `e2e/`) start the studio, both reference servers and the CLI.
- **The pack smoke test** (`scripts/pack-smoke.mjs`) installs the packed tarballs into an empty project and runs `init` and `test`. It is the definition of "installable".

Behavior is specified in [`openspec/specs/`](../openspec/specs/). Each requirement's scenarios are backed by tests.
