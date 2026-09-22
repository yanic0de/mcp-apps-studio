# Proposal

## Why

Stories describe every state of every widget, but checking them is manual: open the studio, click through widgets, scenarios and themes, watch the trace. Nothing stops a widget from shipping with a broken handshake or a malformed message, and there is no artifact a CI job or a reviewer can look at. A headless run over the story matrix turns stories into a test suite.

## What Changes

- New `mcp-apps-studio test [dir]` subcommand: discovers stories, serves the studio on an ephemeral local port, and drives headless Chromium through every widget × scenario (except `live`) × theme (`light`, `dark` by default; `--themes`). For each run it checks that the handshake completed (`ui/initialize` answered and `ui/notifications/initialized` received) and that the trace has no `invalid` events, saves a screenshot of the widget viewport, and writes `report.json` to `--out` (default `.mcp-studio/test`). The exit code is `1` if any run failed.
- The studio accepts deep links: `?widget=&scenario=&theme=&display=&device=` select the initial state after the manifest loads (invalid values are ignored).
- The studio exposes a read-only automation hook `window.__mcpStudio.getLog()` returning the current trace.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cli`: `test` subcommand, test plan and run evaluation.
- `studio-app`: deep links and the automation hook.

## Impact

- Code: `packages/cli` (test plan, runner, bin), `apps/studio` (deep link, hook), e2e.
- Dependencies: `playwright-core` becomes a dependency of the CLI (browser binaries are not bundled: the command explains `npx playwright install chromium` when missing).
- Security: the test server binds `127.0.0.1` with a random token like `start`; no new endpoints.
