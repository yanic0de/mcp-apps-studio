---
"mcp-apps-studio": patch
"@mcp-apps-studio/widget-runtime": patch
---

Dev-loop and robustness fixes:

- **Stories are bundled.** Editing a fixture or helper that a story imports now reloads the studio without a restart.
- **Deleted stories disappear.** When every story is deleted, the studio shows the demo instead of the stale stories.
- **Widget requests are visible.** The studio lists widget requests (open-link, message, model context, download, log, close), and only `http(s)` links are clickable. Before removing a widget, the host sends `ui/resource-teardown`, as real hosts do.
- **No silent failures.**
  - The host bridge no longer leaks unhandled rejections. Such failures now show up in the trace.
  - `connectWidget` cleans up after a failed handshake.
  - A studio file read error answers `500` instead of crashing the CLI.
- **Screenshot paths are safe.** Scenario names and widget ids are sanitized before they become file paths.
- **Provenance.** Packages are published through npm Trusted Publishing and carry provenance.
