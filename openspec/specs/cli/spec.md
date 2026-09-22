# CLI `mcp-apps-studio`

## Purpose

The CLI discovers story files in the user's project, builds a manifest from them and serves the built studio over local HTTP with a one-time token. The `add` subcommand copies a component from the registry into the project. A local dev tool is still an attack surface, so the server is locked down by default.

## Requirements

### Requirement: Story discovery
`findStoryFiles(root)` SHALL recursively find `*.stories.mcp.ts` files, skipping `node_modules`, `dist`, `build` and dot-directories, and return a sorted list.

#### Scenario: Decoy in node_modules
- **WHEN** `node_modules/dep/evil.stories.mcp.ts` exists next to `src/kpi.stories.mcp.ts`
- **THEN** only `src/kpi.stories.mcp.ts` is found

### Requirement: Loading and validating a story
`discoverStories` SHALL transpile a story with esbuild, write a temporary `.mjs` next to the file (so the story's own imports resolve from the user's project), import it, and remove the temporary file even on error. The default export SHALL be validated with `widgetStoryConfigSchema`; the error SHALL name the file and the path to the field.

#### Scenario: Typo in a mock
- **WHEN** a story contains `mocks: { get_data: { kind: 'statik' } }`
- **THEN** discovery rejects with an error containing the file name and `scenarios.default.mocks.get_data.kind`

#### Scenario: No default export
- **WHEN** a story exports only `const x = 1`
- **THEN** the error names the file and says a default export is missing

#### Scenario: Temporary file cleanup
- **WHEN** discovery has finished
- **THEN** no `.mjs` files remain next to the story

### Requirement: Manifest from stories
Every story SHALL become a `WidgetManifestEntry`: `id` — the file name without the suffix, or, when two stories share it, the story path relative to the project root without the suffix (forward slashes); `title`; the widget — `url` when `widget` is an `http(s)://` URL, otherwise `html` with the contents of the file at `widget` relative to the story; `scenarios` — with `mocks` normalized to `{}` when absent and `toolCall` carried over unchanged when present. A story that fails to load SHALL become `{ file, message }` in `errors` instead of aborting discovery.

#### Scenario: Scenario without mocks
- **WHEN** a story contains `scenarios: { empty: {} }`
- **THEN** the manifest contains `scenarios.empty === { mocks: {} }`

#### Scenario: Scenario with a tool call
- **WHEN** a story scenario has `toolCall: { name: 'get_data', input: { q: 1 } }`
- **THEN** the manifest scenario carries the same `toolCall`

#### Scenario: Dev-server widget
- **WHEN** a story has `widget: 'http://localhost:5173/'`
- **THEN** its entry has `url: 'http://localhost:5173/'` and no `html`

#### Scenario: Colliding basenames
- **WHEN** `a/card.stories.mcp.ts` and `b/card.stories.mcp.ts` exist
- **THEN** their ids are `a/card` and `b/card`

#### Scenario: One broken story
- **WHEN** one of two stories has a misspelled mock kind
- **THEN** `widgets` contains the other story and `errors` names the broken file

### Requirement: Localhost only, token on every request
The server SHALL listen on `127.0.0.1` only. Every request SHALL carry the token: in `?token=` (the server then sets an `HttpOnly; SameSite=Strict` cookie) or in the cookie. Comparison SHALL be constant-time (hash both sides + `timingSafeEqual`). Without a valid token the answer SHALL be `401`.

#### Scenario: No token
- **WHEN** `/` is requested without a token or cookie
- **THEN** the status is `401`

#### Scenario: Wrong token
- **WHEN** the request carries `?token=` with a different string of the same length
- **THEN** the status is `401`

#### Scenario: First visit via the printed link
- **WHEN** `/?token=<valid>` is requested
- **THEN** the status is `200` and `Set-Cookie` contains `HttpOnly`
- **AND** subsequent requests with the cookie pass without `?token=`

### Requirement: Manifest on demand
`GET /api/manifest` SHALL rerun discovery on every request, answer JSON `{ widgets, errors }` with `cache-control: no-store`; only an unexpected failure outside story loading SHALL yield `500` with the error text, without terminating the process.

#### Scenario: Story being edited
- **WHEN** two consecutive requests are made with a story edited in between
- **THEN** the second response reflects the edit

#### Scenario: Story broken mid-edit
- **WHEN** a story throws while loading
- **THEN** the status is `200`, the story is listed in `errors`
- **AND** the next `/` request answers `200`

### Requirement: Studio static files
The server SHALL serve files from the studio `dist` with MIME by extension; a path outside `dist` SHALL yield `403`; malformed percent-encoding `400`; a missing file with a known extension `404`; any other path `index.html` (SPA fallback).

#### Scenario: Path traversal
- **WHEN** `/..%2f..%2fetc%2fpasswd` is requested
- **THEN** no file outside `dist` is served

#### Scenario: Typo in an asset name
- **WHEN** `/assets/typo.js` is requested
- **THEN** the status is `404`, not `index.html`

### Requirement: bin entry point
`bin` SHALL accept the project root directory, `--port` (default 4400), `--token` (automation only; default random), locate the built studio — first in the `studio` directory next to the running CLI module (installed package), then in the workspace `@studio/app` build (development) — and print the URL with the token. With no stories it SHALL say the demo widget will be shown.

#### Scenario: Studio not built
- **WHEN** neither location has `index.html`
- **THEN** the process exits with the hint `pnpm -F @studio/app build`

#### Scenario: Installed package
- **WHEN** the CLI runs from its published `dist`
- **THEN** it serves the studio bundled in `dist/studio` without any workspace package

### Requirement: add subcommand
`add <name> [--dir <dir>]` SHALL copy the component's files from `registry.json` into `<dir>/<name>/` (default `src/components`) and remind about the `@mcp-apps-studio/widget-runtime` dependency. An unknown name SHALL yield an error listing the available components.

#### Scenario: Unknown component
- **WHEN** `add nope` runs
- **THEN** the error lists `kpi-card` and `data-table`

### Requirement: test subcommand
`mcp-apps-studio test [dir] [--out <dir>] [--themes <list>]` SHALL discover the stories under `dir`, serve the studio on an ephemeral `127.0.0.1` port with a random token, and in headless Chromium open every widget × scenario × theme (default themes `light,dark`), skipping scenarios named `live`. For each run it SHALL record pass/fail with reasons and save a PNG of the widget viewport under `<out>/<widget>/<scenario>.<theme>.png`, then write `<out>/report.json` (default `out` = `.mcp-studio/test`) and print one line per run. The exit code SHALL be `0` when every run passed, `1` when any failed, `2` when no browser is available (with the install hint).

#### Scenario: Component library passes
- **WHEN** `mcp-apps-studio test ../components` runs after building the library
- **THEN** the exit code is `0`, `report.json` lists every scenario for both themes, and a PNG exists per run

### Requirement: Test plan and run evaluation
The plan SHALL contain one run per widget × non-`live` scenario × theme, in manifest order. A run SHALL pass only if the trace contains the widget's `ui/initialize` request, the host's response to it, and the `ui/notifications/initialized` notification, and contains no `invalid` events; each unmet condition SHALL be listed as a failure reason.

#### Scenario: Plan skips live
- **WHEN** a widget has scenarios `default`, `error`, `live` and themes are `light,dark`
- **THEN** the plan has four runs: `default` and `error` for each theme

#### Scenario: Invalid message fails the run
- **WHEN** the trace of a run contains an `invalid` event `Unsupported notification: wat`
- **THEN** the run fails with a reason quoting that error

#### Scenario: Handshake never completed
- **WHEN** the trace has `ui/initialize` but no `ui/notifications/initialized`
- **THEN** the run fails with a reason naming `ui/notifications/initialized`

### Requirement: init subcommand
`init [widget.html…] [--tool <name>]` SHALL write `<name>.stories.mcp.ts` for each given widget (default: every `*.html` under the current directory containing `ui/initialize` or `@modelcontextprotocol/ext-apps`, skipping `node_modules` and dot-directories) with scenarios `default`, `loading`, `error` and `live` whose `toolCall.name` is `--tool` (default `my_tool`). The story SHALL be placed next to the widget, or under `<root>/stories/` when the widget sits inside a `dist` or `build` directory (build output is wiped on rebuild). It MUST NOT overwrite an existing story.

#### Scenario: Scaffold a story
- **WHEN** `init widgets/weather.html` runs in a project without a story
- **THEN** `widgets/weather.stories.mcp.ts` exists, discovery loads it, and it has the four scenarios

#### Scenario: Built widget
- **WHEN** `init dist/bundle.html` runs
- **THEN** `stories/bundle.stories.mcp.ts` is written with `widget: '../dist/bundle.html'`

#### Scenario: Story already exists
- **WHEN** `init` targets a widget whose story file exists
- **THEN** the file is left untouched and the command reports it as skipped

### Requirement: Watch and live events
While serving, the CLI SHALL watch the project recursively for changes to `*.stories.mcp.ts` and `*.html` files (ignoring `node_modules`, dot-directories and its own temporary story modules) and, debounced by 100 ms, send `event: manifest` to every client of `GET /api/events` (Server-Sent Events, same token rules as every other request).

#### Scenario: Story edited while the studio is open
- **WHEN** a story file is saved
- **THEN** connected clients receive a `manifest` event within a second

#### Scenario: Events without a token
- **WHEN** `/api/events` is requested without a token or cookie
- **THEN** the status is `401`

### Requirement: Vite plugin
`mcp-apps-studio/vite` SHALL export `mcpAppsStudio()`, a Vite plugin that adds `'null'` to `server.cors.origin` (keeping configured origins), so a dev-server widget loads and hot-reloads inside a null-origin sandboxed iframe.

#### Scenario: Plugin config
- **WHEN** the plugin's `config` hook runs on `{ server: { cors: { origin: ['http://a.test'] } } }`
- **THEN** the resulting `server.cors.origin` includes `http://a.test` and `null`

### Requirement: test fails on story errors
`mcp-apps-studio test` SHALL list every discovery error and exit `1` when there is at least one, even if all runs passed.

#### Scenario: Broken story in CI
- **WHEN** one story fails to load
- **THEN** the output names the file and the exit code is `1`
