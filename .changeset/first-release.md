---
"mcp-apps-studio": minor
"@mcp-apps-studio/widget-runtime": minor
---

First public release: Storybook + Playwright for MCP Apps widgets.

**`mcp-apps-studio`**

- `init` scaffolds a `*.stories.mcp.ts` next to each widget, with `default`, `loading`, `error` and `live` scenarios.
- `mcp-apps-studio [dir]` serves the studio on `127.0.0.1`, protected by a token:
  - scenarios with mocked tool calls (`static`, `error`, `rpc-error`, `passthrough`, cancelled);
  - theme, display-mode and device controls;
  - a full RPC trace;
  - live reload;
  - a `live` scenario against any MCP server, which can be recorded into an offline scenario.
- `test` runs every story × theme in headless Chromium. It fails on an incomplete handshake, invalid messages, the wrong rendered target, or a visual diff against committed baselines (`--update-snapshots`). It writes `report.json`, `report.html` and a GitHub job summary.
- `install-browser` installs the Chromium build that matches the bundled Playwright. `add` copies library components (`kpi-card`, `data-table`) into your project.
- `mcp-apps-studio/vite` serves widgets from a Vite dev server into the sandbox, with hot module replacement.
- A composite GitHub Action: `yanic0de/mcp-apps-studio@v0`.

**`@mcp-apps-studio/widget-runtime`**

- `connectWidget` wraps the official `@modelcontextprotocol/ext-apps` 2.x `App`. It records the tool lifecycle before the handshake and applies the host theme, variables and fonts.
- React hooks: `useToolCall`, `useToolLifecycle`, `useWidgetApp`.
