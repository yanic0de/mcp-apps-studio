# MCP Apps Studio

**Storybook + Playwright for [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) widgets.**

Develop widgets component-first against stories and mocks — no server, no chat, no LLM — and run every story headlessly in CI. Everything a real host (Claude, ChatGPT) does to your widget — sandboxed iframe render, JSON-RPC bridge, theme and display-mode context, tool calls — reproduced on your machine and made observable. Storybook-style scenarios for your widgets, mocked or live tool calls, and a full RPC trace of every message that crosses the iframe boundary.

Targets the MCP Apps extension (SEP-1865), spec version `2026-01-26`.

> **Status: pre-release (0.x).** Packaged for npm; the first release is pending.

## Why

Building a widget for an MCP Apps host means round-tripping through a real host to see anything: deploy the server, open the chat, invoke the tool, hope the iframe loads. You can't easily reproduce the loading state, a backend error, dark mode, or picture-in-picture. And the protocol between your widget and the host is invisible — when something breaks, you're guessing.

MCP Apps Studio replaces the host with a controllable one:

- **Scenarios instead of deploys.** Describe a widget and its states (`default`, `loading`, `error`, `empty`) in a story file. Switch between them in one click.
- **Mocks instead of backends.** Every `tools/call` is answered from a scenario: a static result, an error with a code, a delay, or passthrough to a real server.
- **A trace instead of guessing.** Every request, response and notification in both directions is logged, including malformed messages your widget shouldn't have sent.
- **Stories as a test suite.** `mcp-apps-studio test` plays every scenario in headless Chromium in CI: the SDK handshake must complete and nothing malformed may cross the bridge.
- **Fixtures from reality.** Record a session against your real server and save it as an offline scenario.
- **Real hosts are strict; so is this one.** Sandboxed iframe with `allow-scripts` only, null-origin trust model, every incoming message validated before dispatch. If it works here, you haven't accidentally relied on `window.parent` or `allow-same-origin`.

**Not a server inspector.** For chatting with an LLM, OAuth flows or poking at a server's tools, use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) or [MCPJam](https://github.com/MCPJam/inspector). MCP Apps Studio is for the widget: its states, its protocol hygiene, its regression tests.

## What's inside

| Package | What it is |
|---|---|
| `apps/studio` | The studio UI: widget and scenario picker, theme / display-mode controls, sandboxed canvas, RPC trace panel |
| `packages/host-emulator` | DOM-free host core: JSON-RPC bridge, protocol adapter, mock router, orchestrator. Usable from Node tests |
| `packages/widget-runtime` | Studio conveniences on top of the official `@modelcontextprotocol/ext-apps` `App`: `connectWidget` (lifecycle recorded before the handshake, host theme applied), React hooks |
| `packages/cli` | `mcp-apps-studio`: discovers `*.stories.mcp.ts` in your project, serves the studio locally with token auth, copies components into your project |
| `packages/components` | Source-distributed widget library (shadcn model): `kpi-card`, `data-table`, each with stories and a text fallback |
| `packages/shared` | Protocol constants, zod schemas, `RpcError`, request correlation |
| `packages/example-server` | Reference MCP Apps server on the public SDKs, no workspace deps. Copy it to start your own |
| `packages/test-server` | Test polygon: one tool per host behavior (`echo`, `slow_metrics`, `fail`, `get_rows`, `counter`) plus a "Protocol Inspector" widget |

## Install

In your MCP Apps project (Node 20.11+):

```bash
npx mcp-apps-studio init                 # scaffold a *.stories.mcp.ts next to every widget HTML it finds
npx mcp-apps-studio                      # the studio over your stories → http://127.0.0.1:4400/?token=…
npx mcp-apps-studio install-browser      # once: Chromium matching the bundled Playwright
npx mcp-apps-studio test                 # every story × theme in headless Chromium; exit 1 on failure
```

The studio live-reloads: save a story or a widget HTML and the open studio refetches and remounts the widget, keeping your scenario. A story that fails to load shows up in a banner instead of taking the others down (and fails `test`).

**Widgets straight from Vite, with HMR.** Point a story at your dev server and add the plugin:

```ts
// vite.config.ts
import { mcpAppsStudio } from 'mcp-apps-studio/vite';
export default defineConfig({ plugins: [mcpAppsStudio()] });

// weather.stories.mcp.ts
export default { title: 'Weather', widget: 'http://localhost:5173/', scenarios: { /* … */ } };
```

The widget still runs in the host-faithful sandbox (`allow-scripts` only, `null` origin). Vite refuses module scripts to a `null` origin by default; the plugin adds it to `server.cors.origin` — a dev-server-only trade-off (any sandboxed page could then read your dev server while it runs).

Building widgets with the SDK? `@mcp-apps-studio/widget-runtime` adds `connectWidget` and React hooks on top of the official `App` (see below).

## Develop from source

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

Both servers listen on `127.0.0.1` only; set `HOST=0.0.0.0` (e.g. in a container) to expose them.

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

Deep links open a given state directly: `?widget=kpi-card&scenario=error&theme=dark&display=fullscreen&device=mobile`. In the `live` scenario, **Save scenario** turns the real session into an offline `recorded-<n>` scenario and copies a paste-ready story snippet.

### 3. Test every story headlessly

```bash
npx mcp-apps-studio install-browser             # once
pnpm -F mcp-apps-studio start test /path/to/your/project --out .mcp-studio/test
#   ✓ kpi-card/default [light]
#   ✗ kpi-card/error [dark]
#       invalid message: Unsupported notification: wat
#   11 passed, 1 failed
```

Every widget × scenario (except `live`) × theme runs in headless Chromium: the SDK handshake must complete and the trace must have no invalid messages. Screenshots, `report.json` and a reviewable `report.html` land in `--out`; the exit code is `1` on any failure, so it drops into CI as is.

**Visual regression (opt-in).** `test --update-snapshots` writes baselines to `mcp-studio-snapshots/` (commit them). From then on every run is diffed against its baseline (`--threshold 0.1`, `--max-diff-pixels 0` by default); a change fails the run and `report.html` shows baseline, actual and diff side by side. Fonts and antialiasing differ between OSes — generate baselines on the platform CI uses.

**GitHub Actions.** One step; the report is attached as an artifact and summarized on the run page:

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm ci
- uses: yanic0de/mcp-app-proba@main   # MCP Apps Studio story tests
  with:
    directory: .                        # where your *.stories.mcp.ts live
```

### Scenario reference

| Field | Meaning |
|---|---|
| `toolCall` | The model's call that rendered the widget: `{ name, input?, partialInputs?, result? }`. Played after `ui/notifications/initialized` as `tool-input-partial`* → `tool-input` → `tool-result` or `tool-cancelled`. |
| `mocks` | Answers to the widget's own `tools/call`, keyed by tool name. |

| Mock `kind` | Fields | Answer |
|---|---|---|
| `static` | `structuredContent?`, `content?`, `delayMs?` | `CallToolResult`; `content` defaults to a JSON text block of `structuredContent` |
| `error` | `message`, `delayMs?` | `CallToolResult` with `isError: true` — how servers report tool failures |
| `rpc-error` | `error: { code, message }`, `delayMs?` | JSON-RPC error (protocol failure); not allowed as a `toolCall.result` |
| `passthrough` | — | Forward to the connected MCP server (same as no mock in `live`) |
| `cancelled` | `reason?`, `delayMs?` | `toolCall.result` only: `tool-cancelled` |

## Write widgets that will work on real hosts

Widgets talk to the host through the official MCP Apps SDK, [`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) — its `App` class is the reference implementation of the widget side of SEP-1865, so a widget that works here works in any MCP Apps host. `@mcp-apps-studio/widget-runtime` adds only what the SDK leaves to you: `connectWidget` records the originating tool call **before** the handshake (hosts send `tool-result` right after it, often before your UI mounts) and keeps the document in sync with the host theme, style variables and fonts.

```ts
import { connectWidget, toolResultData } from '@mcp-apps-studio/widget-runtime';

const { app, lifecycle } = await connectWidget({ appInfo: { name: 'kpi-card', version: '1.0.0' } });
// app is the SDK App: ui/initialize → ui/notifications/initialized done, auto-resize on

lifecycle.subscribe(() => render(lifecycle.getSnapshot()));           // tool-input → tool-result | cancelled
const result = await app.callServerTool({ name: 'get_metrics', arguments: {} }); // CallToolResult
const metrics = toolResultData(result);                               // structuredContent, throws the isError text
await app.openLink({ url: 'https://example.com' });                   // …and every other SDK method
```

React:

```tsx
import { WidgetProvider, useToolCall, useToolLifecycle, useWidgetApp } from '@mcp-apps-studio/widget-runtime/react';

createRoot(root).render(<WidgetProvider session={await connectWidget({ appInfo })}><KpiCard /></WidgetProvider>);

function KpiCard() {
  const { data, error, loading, call } = useToolCall<Metrics>('get_metrics'); // data = structuredContent
  useEffect(() => void call(), [call]);
  // latest call wins: an overlapping stale response never overwrites newer state
}

function FromHost() {
  const { status, input, data, error } = useToolLifecycle<Metrics>(); // tool-input → tool-result
  const app = useWidgetApp();                                          // the SDK App for everything else
}
```

Library components follow one contract — theming only through `--widget-*` CSS variables and `[data-theme='dark']`, a text-only fallback per component, stories for every state — and are copied into your project rather than depended on:

```bash
pnpm -F mcp-apps-studio start add data-table --dir src/components
```

Files you already have are kept (they may carry your edits) and listed as skipped; `--force` replaces them with the registry version.

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

- [x] npm packaging: `npx mcp-apps-studio` in any project (first release pending)
- [x] Headless story runner (`mcp-apps-studio test`)
- [x] `@modelcontextprotocol/ext-apps` 2.x on MCP SDK v2
- [x] Dev loop: live reload, per-story errors, widgets from a Vite dev server with HMR
- [ ] Visual diffs + GitHub Action
- [ ] `openai-apps` adapter for the OpenAI Apps SDK dialect
- [ ] `pending` mock kind (never resolves) instead of the one-hour delay idiom
- [ ] Size / CSP assertions: flag widgets that exceed container dimensions or violate a host CSP

## License

[MIT](LICENSE)
