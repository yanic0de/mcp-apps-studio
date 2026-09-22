# MCP Apps Studio

**A local host emulator and test bench for [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) widgets.**

Everything a real host (Claude, ChatGPT) does to your widget — sandboxed iframe render, JSON-RPC bridge, theme and display-mode context, tool calls — reproduced on your machine and made observable. Storybook-style scenarios for your widgets, mocked or live tool calls, and a full RPC trace of every message that crosses the iframe boundary.

Targets the MCP Apps extension (SEP-1865), spec version `2026-01-26`.

> **Status: pre-release.** Runs from source today (see Quick start). Publishing to npm is the next milestone.

## Why

Building a widget for an MCP Apps host means round-tripping through a real host to see anything: deploy the server, open the chat, invoke the tool, hope the iframe loads. You can't easily reproduce the loading state, a backend error, dark mode, or picture-in-picture. And the protocol between your widget and the host is invisible — when something breaks, you're guessing.

MCP Apps Studio replaces the host with a controllable one:

- **Scenarios instead of deploys.** Describe a widget and its states (`default`, `loading`, `error`, `empty`) in a story file. Switch between them in one click.
- **Mocks instead of backends.** Every `tools/call` is answered from a scenario: a static result, an error with a code, a delay, or passthrough to a real server.
- **A trace instead of guessing.** Every request, response and notification in both directions is logged, including malformed messages your widget shouldn't have sent.
- **Real hosts are strict; so is this one.** Sandboxed iframe with `allow-scripts` only, null-origin trust model, every incoming message validated before dispatch. If it works here, you haven't accidentally relied on `window.parent` or `allow-same-origin`.

## What's inside

| Package | What it is |
|---|---|
| `apps/studio` | The studio UI: widget and scenario picker, theme / display-mode controls, sandboxed canvas, RPC trace panel |
| `packages/host-emulator` | DOM-free host core: JSON-RPC bridge, protocol adapter, mock router, orchestrator. Usable from Node tests |
| `packages/widget-runtime` | The widget side: `WidgetClient` (vanilla) and React hooks. The only sanctioned way for a widget to talk to a host |
| `packages/cli` | `mcp-apps-studio`: discovers `*.stories.mcp.ts` in your project, serves the studio locally with token auth, copies components into your project |
| `packages/components` | Source-distributed widget library (shadcn model): `kpi-card`, `data-table`, each with stories and a text fallback |
| `packages/shared` | Protocol constants, zod schemas, `RpcError`, request correlation |
| `packages/example-server` | Reference MCP Apps server on the public SDKs, no workspace deps. Copy it to start your own |
| `packages/test-server` | Test polygon: one tool per host behavior (`echo`, `slow_metrics`, `fail`, `get_rows`, `counter`) plus a "Protocol Inspector" widget |

## Quick start

Requires Node 22+ and pnpm.

```bash
git clone https://github.com/yanic0de/mcp-app-proba.git
cd mcp-app-proba
pnpm install

# 1. The studio with a built-in demo widget
pnpm -F @studio/app dev
# open http://localhost:5173 — switch scenarios, flip the theme, expand trace rows

# 2. Point it at a real MCP server
pnpm -F @studio/example-server dev      # reference server on :3100
# in the studio, pick the "live" scenario: the widget HTML now comes from
# resources/read and every tools/call is proxied over streamable HTTP

# 3. Poke the protocol
pnpm -F @studio/test-server dev         # polygon server on :3200
# open http://localhost:5173/?server=http://localhost:3200/mcp, pick "live"
```

## Test your own widgets

### 1. Write a story next to your widget

```ts
// src/widgets/kpi-card.stories.mcp.ts
export default {
  title: 'KPI Card',
  widget: './kpi-card.html', // path relative to this file
  scenarios: {
    default: {
      // the model's call that rendered the widget: pushed as tool-input → tool-result after initialized
      toolCall: {
        name: 'get_metrics',
        input: { period: '30d' },
        result: { kind: 'static', structuredContent: { value: 12840, delta: 8.3, label: 'MAU' } },
      },
      mocks: {
        // the widget's own tools/call, answered as a CallToolResult
        // (`content` defaults to a JSON text block of structuredContent)
        get_metrics: { kind: 'static', structuredContent: { value: 12840, delta: 8.3, label: 'MAU' } },
      },
    },
    loading: {
      mocks: { get_metrics: { kind: 'static', structuredContent: {}, delayMs: 3_600_000 } },
    },
    error: {
      // a tool failure (isError result); use kind: 'rpc-error' for a JSON-RPC protocol error
      mocks: { get_metrics: { kind: 'error', message: 'Metrics backend unavailable' } },
    },
    cancelled: { toolCall: { name: 'get_metrics', result: { kind: 'cancelled', reason: 'user' } } },
    // no mocks → the linked tool is called on the server from ?server= and every widget call is proxied
    live: { mocks: {} },
  },
};
```

Type-check it with `defineWidgetStory(...)` from the CLI package. Story files are validated at discovery time: a misspelled mock kind fails with the file name and the exact path (`scenarios.default.mocks.get_metrics.kind`) instead of surfacing in the browser.

### 2. Serve the studio over your project

```bash
pnpm -F @studio/app build                       # once
pnpm -F mcp-apps-studio start /path/to/your/project
#   MCP Apps Studio
#   project: /path/to/your/project
#   widgets: 3
#   → http://127.0.0.1:4400/?token=…
```

Stories are rediscovered on every page refresh, so edits land without restarting. The server binds `127.0.0.1` only and requires the printed token on every request (query once, then an `HttpOnly` cookie).

### Mock reference

| `kind` | Fields | Behavior |
|---|---|---|
| `static` | `result`, `delayMs?` | Resolve `tools/call` with `result` after the optional delay |
| `error` | `error: { code, message }`, `delayMs?` | Reject with a JSON-RPC error carrying that code |
| `passthrough` | — | Forward to the connected MCP server (same as no mock in `live`) |

## Write widgets that will work on real hosts

Use `@studio/widget-runtime` instead of touching `window.parent` yourself. It does the `ui/initialize` handshake, correlates requests, applies timeouts, and keeps host context in sync.

```ts
import { WidgetClient, applyHostContextToDocument } from '@studio/widget-runtime';

const client = new WidgetClient();
const ctx = await client.connect();          // ui/initialize → host context
applyHostContextToDocument(ctx);              // data-theme + --host CSS variables
client.onHostContextChanged(() => applyHostContextToDocument(client.getHostContext()!));

const metrics = await client.callTool('get_metrics', {}); // rejects with RpcError on failure
client.sendSizeChanged({ width: 360, height: 220 });
```

React:

```tsx
import { WidgetProvider, useToolCall } from '@studio/widget-runtime/react';

function KpiCard() {
  const { data, error, loading, call } = useToolCall<Metrics>('get_metrics');
  useEffect(() => void call(), [call]);
  // latest call wins: an overlapping stale response never overwrites newer state
}
```

Library components follow one contract — theming only through `--widget-*` CSS variables and `[data-theme='dark']`, a text-only fallback per component, stories for every state — and are copied into your project rather than depended on:

```bash
pnpm -F mcp-apps-studio start add data-table --dir src/components
```

## Using it as a test tool

The studio is the interactive surface. The same core runs headless.

**Assert on the protocol from Vitest.** `HostEmulator` needs only a `Transport`; an in-memory pair lets you drive a widget-side script and inspect the trace without a browser:

```ts
import { HostEmulator, McpAppsAdapter, createInMemoryTransportPair } from '@studio/host-emulator';

const [hostT, widgetT] = createInMemoryTransportPair();
const log = [];
new HostEmulator({
  adapter: new McpAppsAdapter(),
  transport: hostT,
  mocks: { get_metrics: { kind: 'static', structuredContent: { value: 1 } } },
  onLog: (ev) => log.push(ev),
}).start();

widgetT.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_metrics' } });
// … await, then:
expect(log.filter((e) => e.kind === 'invalid')).toEqual([]);
```

**Assert on the widget from Playwright.** The studio exposes stable hooks: the iframe is `iframe[title="widget under test"]`, trace rows are `.trace-row`, controls are labelled `Widget`, `Scenario`, `Theme`, `Display`. The repository's own `e2e/` suite is the pattern: pick a scenario, assert inside the frame, assert on the trace.

**What the emulator catches today**

- Messages that aren't valid JSON-RPC 2.0, or valid but with the wrong params shape — logged as `invalid` with the field that failed.
- Unknown methods (`METHOD_NOT_FOUND`), unknown resources (`RESOURCE_NOT_FOUND`), missing mocks.
- Notifications the widget sends that the host doesn't understand — they have no reply channel, so they surface in the trace.
- Widgets that break under a strict sandbox (no `allow-same-origin`, null origin).

**Planned:** a headless `mcp-apps-studio test` runner that loads every story, plays each scenario in a real browser, and fails CI on invalid messages or a trace that diverges from a committed golden log. See the roadmap.

## Architecture

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
```

- **`MessageBridge`** validates every incoming message with zod before dispatch and correlates request ids with timeouts. Widgets are untrusted code.
- **`HostAdapter`** is a pure translator: wire message → semantic action, host event → wire notification. No transport, no side effects, testable against golden logs. `McpAppsAdapter` is the only implementation today; the OpenAI Apps SDK dialect slots in here.
- **`IframeTransport`** is the single DOM edge. Sandboxed widgets have a null origin, so `event.source === iframe.contentWindow` is the only trust signal.

The full behavior is specified in [`openspec/`](openspec/) — one spec per capability, requirement by requirement, each scenario backed by a test.

## Development

```bash
pnpm test                 # vitest, runs in Node (no jsdom)
pnpm typecheck            # tsc --noEmit per package
pnpm lint                 # biome: format + lint + import order
pnpm e2e                  # playwright (chromium); starts vite, both servers and the CLI itself
pnpm -F @studio/components build   # bundle library widgets to dist/<name>.html
```

Conventions: TDD per task, tests next to source, core packages must stay runnable in Node. Behavior changes go through `openspec/changes/` first — see [`openspec/config.yaml`](openspec/config.yaml) and the `/opsx:propose` → `/opsx:apply` → `/opsx:archive` workflow. [`CLAUDE.md`](CLAUDE.md) holds the constraints that are easy to violate; read it before your first PR.

## Roadmap

- [ ] npm publish: build step for the packages, `npx mcp-apps-studio` in any project
- [ ] Headless conformance runner (`mcp-apps-studio test`): play every scenario in CI, golden-log diffs
- [ ] `openai-apps` adapter for the OpenAI Apps SDK dialect
- [ ] Widget follow-up messages, once the wire name is confirmed by the upstream SDK
- [ ] `pending` mock kind (never resolves) instead of the one-hour delay idiom
- [ ] Size / CSP assertions: flag widgets that exceed container dimensions or violate a host CSP

## License

[MIT](LICENSE)
