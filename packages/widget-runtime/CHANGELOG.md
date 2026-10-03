# @mcp-apps-studio/widget-runtime

## 0.2.0

### Patch Changes

- [#5](https://github.com/yanic0de/mcp-apps-studio/pull/5) [`0ba2d95`](https://github.com/yanic0de/mcp-apps-studio/commit/0ba2d95ada137973ba3d78f21645272c6e0ff247) Thanks [@yanic0de](https://github.com/yanic0de)! - Dev-loop and robustness fixes:

  - **Stories are bundled.** Editing a fixture or helper that a story imports now reloads the studio without a restart.
  - **Deleted stories disappear.** When every story is deleted, the studio shows the demo instead of the stale stories.
  - **Widget requests are visible.** The studio lists widget requests (open-link, message, model context, download, log, close), and only `http(s)` links are clickable. Before removing a widget, the host sends `ui/resource-teardown`, as real hosts do.
  - **No silent failures.**
    - The host bridge no longer leaks unhandled rejections. Such failures now show up in the trace.
    - `connectWidget` cleans up after a failed handshake.
    - A studio file read error answers `500` instead of crashing the CLI.
  - **Screenshot paths are safe.** Scenario names and widget ids are sanitized before they become file paths.
  - **Provenance.** Packages are published through npm Trusted Publishing and carry provenance.

## 0.1.0

### Minor Changes

- [#1](https://github.com/yanic0de/mcp-apps-studio/pull/1) [`7edca31`](https://github.com/yanic0de/mcp-apps-studio/commit/7edca31c09a41371297bab247702d2a13af45eea) Thanks [@yanic0de](https://github.com/yanic0de)! - First public release: Storybook + Playwright for MCP Apps widgets.

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
