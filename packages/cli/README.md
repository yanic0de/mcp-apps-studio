# mcp-apps-studio

**Storybook + Playwright for [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) widgets.**

Develop widgets against stories and mocked tool calls, with no server, chat or LLM in the loop. Then run every story headlessly in CI. The studio plays the host (Claude, ChatGPT): sandboxed iframe, JSON-RPC bridge, theme and display-mode context, tool calls. It also shows every message that crosses the iframe boundary.

Targets the MCP Apps extension (SEP-1865), spec version `2026-01-26`. Node 22+.

![The studio: widget, scenario and theme controls, the sandboxed canvas and the RPC trace](https://raw.githubusercontent.com/yanic0de/mcp-apps-studio/main/docs/assets/studio-light.png)

## Quickstart

In your MCP Apps project:

```bash
npm i -D mcp-apps-studio              # stories import its types, so install it locally
npx mcp-apps-studio init              # a *.stories.mcp.ts next to every widget HTML it finds
npx mcp-apps-studio                   # the studio → http://127.0.0.1:4400/?token=…
npx mcp-apps-studio install-browser   # once: Chromium matching the bundled Playwright
npx mcp-apps-studio test              # every story × theme headless; exit 1 on failure
```

When you save a story or a widget, the studio reloads it and keeps your scenario. A story that fails to load is reported by file, and the other stories keep working.

## Commands

| Command | What it does |
|---|---|
| `mcp-apps-studio [dir] [--port <n>]` | Serves the studio over the stories under `dir`. It binds to `127.0.0.1` only, and every request needs the printed token. |
| `mcp-apps-studio test [dir]` | Runs every widget × scenario (except `live`) × theme in headless Chromium. See the flags below. |
| `mcp-apps-studio init [widget.html…] [--tool <name>]` | Scaffolds stories with `default`, `loading`, `error` and `live` scenarios. It never overwrites an existing story. |
| `mcp-apps-studio add <component> [--dir <dir>] [--force]` | Copies a library component (`kpi-card`, `data-table`) into your project. Existing files are kept unless you pass `--force`. |
| `mcp-apps-studio install-browser [--with-deps]` | Installs the Chromium build that matches the bundled `playwright-core`. |

`mcp-apps-studio --help` and `mcp-apps-studio <command> --help` list every flag. A mistyped command or flag fails with a one-line `error:` and exit code `1`. `test` exits `2` when Chromium is missing. If an unexpected error happens, set `MCP_APPS_STUDIO_DEBUG=1` to see its stack.

### `test` flags

| Flag | Default | Meaning |
|---|---|---|
| `--out <dir>` | `.mcp-studio/test` | Screenshots, `report.json`, `report.html` |
| `--themes <list>` | `light,dark` | Themes to run |
| `--update-snapshots` | off | Write baselines from **passing** runs |
| `--snapshots <dir>` | `mcp-studio-snapshots` | Baseline directory. Once it exists, runs are compared against it. |
| `--threshold <0..1>` | `0.1` | Per-pixel color tolerance |
| `--max-diff-pixels <n>` | `0` | Number of differing pixels still accepted |

A run passes when all of these hold:

- the studio rendered the requested widget, scenario and theme;
- the SDK handshake completed (`ui/initialize` → response → `ui/notifications/initialized`);
- no invalid message crossed the bridge;
- the screenshot matches its baseline (only when baselines exist).

## Stories

```ts
// src/widgets/kpi-card.stories.mcp.ts
import { defineWidgetStory } from 'mcp-apps-studio';

export default defineWidgetStory({
  title: 'KPI Card',
  widget: './kpi-card.html', // relative to this file, or a dev-server URL
  scenarios: {
    default: {
      // the model's call that rendered the widget: tool-input → tool-result after the handshake
      toolCall: {
        name: 'get_metrics',
        input: { period: '30d' },
        result: { kind: 'static', structuredContent: { value: 12840, delta: 8.3 } },
      },
      // the widget's own tools/call, answered as a CallToolResult
      mocks: { get_metrics: { kind: 'static', structuredContent: { value: 12840, delta: 8.3 } } },
    },
    loading: { mocks: { get_metrics: { kind: 'static', structuredContent: {}, delayMs: 3_600_000 } } },
    error: { mocks: { get_metrics: { kind: 'error', message: 'Metrics backend unavailable' } } },
    live: { mocks: {} }, // no mocks: calls go to the MCP server given by ?server=
  },
});
```

These are the mock kinds:

| Kind | What the widget receives |
|---|---|
| `static` | A `CallToolResult` (`structuredContent`, `content`, `delayMs`) |
| `error` | A `CallToolResult` with `isError: true`, which is how servers report tool failures |
| `rpc-error` | A JSON-RPC error, i.e. a protocol failure |
| `passthrough` | The call is forwarded to the connected MCP server |

`toolCall.result` may also be `cancelled`. Stories are validated when they are loaded, so a typo is reported with the file and the exact path of the bad field.

## CI

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm ci
- uses: yanic0de/mcp-apps-studio@v0
  with:
    directory: .   # where your *.stories.mcp.ts live
```

The report is attached as an artifact and summarized on the run page. For visual regression, run `test --update-snapshots` once and commit `mcp-studio-snapshots/`. Generate the baselines on the platform CI uses, because fonts render differently across operating systems.

## Widgets from a Vite dev server

```ts
// vite.config.ts
import { mcpAppsStudio } from 'mcp-apps-studio/vite';
export default defineConfig({ plugins: [mcpAppsStudio()] });
```

Then point the story at `widget: 'http://localhost:5173/'`, and hot module replacement works inside the sandbox.

**Trade-off:** the plugin adds the `null` origin to Vite's CORS allowlist. While the dev server runs, any sandboxed page in your browser can read it, including your source and inlined `VITE_*` values. Keep secrets out of `VITE_*`, and stop the dev server before you browse untrusted sites.

## More

- The SDK helpers for widgets are in [`@mcp-apps-studio/widget-runtime`](https://www.npmjs.com/package/@mcp-apps-studio/widget-runtime): `connectWidget` and React hooks.
- For docs, architecture and contributing, see the [project repository](https://github.com/yanic0de/mcp-apps-studio).

MIT
