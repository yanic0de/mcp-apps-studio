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
`discoverStories` SHALL bundle a story with esbuild — local (relative) imports inlined, package imports left external — write the result to a temporary `.mjs` next to the file (so package imports resolve from the user's project), import it, and remove the temporary file even on error. Each discovered story SHALL report the absolute paths of the local files it depends on. The default export SHALL be validated with `widgetStoryConfigSchema`; the error SHALL name the file and the path to the field.

#### Scenario: Typo in a mock
- **WHEN** a story contains `mocks: { get_data: { kind: 'statik' } }`
- **THEN** discovery rejects with an error containing the file name and `scenarios.default.mocks.get_data.kind`

#### Scenario: No default export
- **WHEN** a story exports only `const x = 1`
- **THEN** the error names the file and says a default export is missing

#### Scenario: Temporary file cleanup
- **WHEN** discovery has finished
- **THEN** no `.mjs` files remain next to the story

#### Scenario: Edited fixture
- **WHEN** a story imports `./rows.json`, discovery runs, `rows.json` is edited and discovery runs again
- **THEN** the second manifest contains the edited data and the story's dependencies include `rows.json`

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
`bin` SHALL accept the project root directory (default the current directory; it MUST exist and be a directory), `--port` (default 4400; an integer from 1 to 65535), `--token` (automation only; at least 32 characters from `[A-Za-z0-9_-]`; default random), locate the built studio — first in the `studio` directory next to the running CLI module (installed package), then in the workspace `@studio/app` build (development) — and print the URL with the token. With no stories it SHALL say the demo widget will be shown. When the port is taken it SHALL print that the port is in use and suggest `--port`, and exit `1`.

#### Scenario: Studio not built
- **WHEN** the CLI runs from the workspace and neither location has `index.html`
- **THEN** the process exits `1` with the hint `pnpm -F @studio/app build`

#### Scenario: Installed package without studio assets
- **WHEN** the CLI runs from an installed package whose `dist/studio` is missing and no workspace package exists
- **THEN** the process exits `1` telling the user to reinstall `mcp-apps-studio`, without a stack trace

#### Scenario: Installed package
- **WHEN** the CLI runs from its published `dist`
- **THEN** it serves the studio bundled in `dist/studio` without any workspace package

#### Scenario: Port out of range
- **WHEN** `mcp-apps-studio --port 70000` runs
- **THEN** stderr names `--port` and the exit code is `1`

#### Scenario: Port in use
- **WHEN** another process listens on 127.0.0.1:4400 and `mcp-apps-studio` starts with the default port
- **THEN** stderr says port 4400 is already in use and suggests `--port`, and the exit code is `1`

#### Scenario: Weak token
- **WHEN** `mcp-apps-studio --token abc` runs
- **THEN** stderr names `--token` and the exit code is `1`

### Requirement: add subcommand
`add <name> [--dir <dir>] [--force]` SHALL copy the component's files from `registry.json` into `<dir>/<name>/` (default `src/components`) and remind about the `@mcp-apps-studio/widget-runtime` dependency. A file that already exists in the destination MUST NOT be overwritten unless `--force` is given; skipped files SHALL be listed as skipped. An unknown or missing name SHALL print an error listing the available components, without a stack trace, and exit `1`.

#### Scenario: Unknown component
- **WHEN** `add nope` runs
- **THEN** the error lists `kpi-card` and `data-table`, no stack trace is printed and the exit code is `1`

#### Scenario: Re-adding keeps local edits
- **WHEN** `add kpi-card` runs a second time after the user edited `KpiCard.tsx`
- **THEN** `KpiCard.tsx` keeps the user's content and is reported as skipped

#### Scenario: Forced re-add
- **WHEN** `add kpi-card --force` runs after the user edited `KpiCard.tsx`
- **THEN** `KpiCard.tsx` is replaced with the registry version

### Requirement: test subcommand
`mcp-apps-studio test [dir] [--out <dir>] [--themes <list>]` SHALL discover the stories under `dir`, serve the studio on an ephemeral `127.0.0.1` port with a random token, and in headless Chromium open every widget × scenario × theme (default themes `light,dark`), skipping scenarios named `live`. For each run it SHALL record pass/fail with reasons and save a PNG of the widget viewport under `<out>/<widget>/<scenario>.<theme>.png`, then write `<out>/report.json` (default `out` = `.mcp-studio/test`) and print one line per run. The exit code SHALL be `0` when every run passed, `1` when any failed, `2` when no browser is available (with the install hint).

#### Scenario: Component library passes
- **WHEN** `mcp-apps-studio test ../components` runs after building the library
- **THEN** the exit code is `0`, `report.json` lists every scenario for both themes, and a PNG exists per run

### Requirement: Test plan and run evaluation
The plan SHALL contain one run per widget × non-`live` scenario × theme, in manifest order. A run SHALL pass only if the studio rendered the run's widget, scenario and theme, the trace contains the widget's `ui/initialize` request, the host's response to it, and the `ui/notifications/initialized` notification, and contains no `invalid` events; each unmet condition SHALL be listed as a failure reason. A run that throws (navigation failure, crashed page, unreadable baseline) SHALL be recorded as a failed run whose reason is the error message, the remaining runs SHALL still execute, and the reports SHALL still be written.

#### Scenario: Plan skips live
- **WHEN** a widget has scenarios `default`, `error`, `live` and themes are `light,dark`
- **THEN** the plan has four runs: `default` and `error` for each theme

#### Scenario: Invalid message fails the run
- **WHEN** the trace of a run contains an `invalid` event `Unsupported notification: wat`
- **THEN** the run fails with a reason quoting that error

#### Scenario: Handshake never completed
- **WHEN** the trace has `ui/initialize` but no `ui/notifications/initialized`
- **THEN** the run fails with a reason naming `ui/notifications/initialized`

#### Scenario: Studio rendered another target
- **WHEN** a run requests widget `kpi`, scenario `error` but the studio reports widget `kpi`, scenario `default`
- **THEN** the run fails with a reason naming the requested and the rendered target

#### Scenario: One run crashes
- **WHEN** navigation of the second of three runs throws `net::ERR_ABORTED`
- **THEN** the second run fails with a reason containing `net::ERR_ABORTED`, the first and third runs are evaluated normally, and `report.json` lists all three

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
While serving, the CLI SHALL watch the project recursively for changes to `*.stories.mcp.ts` and `*.html` files and to the local files the stories depend on (ignoring `node_modules`, dot-directories and its own temporary story modules) and, debounced by 100 ms, send `event: manifest` to every client of `GET /api/events` (Server-Sent Events, same token rules as every other request).

#### Scenario: Story edited while the studio is open
- **WHEN** a story file is saved
- **THEN** connected clients receive a `manifest` event within a second

#### Scenario: Fixture edited while the studio is open
- **WHEN** a JSON file imported by a story is saved
- **THEN** the change counts as relevant and connected clients receive a `manifest` event

#### Scenario: Unrelated source edited
- **WHEN** a `.ts` file no story imports is saved
- **THEN** no `manifest` event is sent

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

### Requirement: Visual snapshots
`test` SHALL accept `--update-snapshots`, `--snapshots <dir>` (default `mcp-studio-snapshots` under the tested directory), `--threshold <0..1>` (default `0.1`) and `--max-diff-pixels <n>` (default `0`). With `--update-snapshots` the screenshot of every passing run SHALL be written as its baseline `<dir>/<widget>/<scenario>.<theme>.png` and the run SHALL not be visually compared; a failing run MUST NOT write or replace its baseline. Otherwise, when the snapshot directory exists, each run SHALL be compared with its baseline: more differing pixels than `--max-diff-pixels`, a different image size or a missing baseline SHALL fail the run with a reason, and a differing run SHALL write `<name>.diff.png` next to its screenshot. When the directory does not exist, no visual comparison SHALL happen.

#### Scenario: Unchanged widget
- **WHEN** baselines were written with `--update-snapshots` and `test` runs again unchanged
- **THEN** every run passes

#### Scenario: Visual change
- **WHEN** a widget's colors change after the baselines were written
- **THEN** the affected runs fail with a reason stating the number of differing pixels and a `.diff.png` exists

#### Scenario: New story without baseline
- **WHEN** the snapshot directory exists but has no baseline for a run
- **THEN** that run fails with a reason suggesting `--update-snapshots`

#### Scenario: Broken run is not blessed
- **WHEN** `test --update-snapshots` runs and a run's handshake never completes
- **THEN** that run fails and its baseline file is neither created nor replaced

### Requirement: Test report
`test` SHALL write `report.html` next to `report.json`, listing every run with status and failure reasons and, for runs with a visual difference, the baseline, actual and diff images (relative paths). When the `GITHUB_STEP_SUMMARY` environment variable names a file, a Markdown table of the runs SHALL be appended to it.

#### Scenario: Reviewing a failure
- **WHEN** a run fails visually
- **THEN** `report.html` shows its baseline, actual and diff images side by side

#### Scenario: GitHub job summary
- **WHEN** `GITHUB_STEP_SUMMARY` is set
- **THEN** the file gains a table with one row per run and a pass/fail count

### Requirement: install-browser subcommand
`install-browser [--with-deps]` SHALL install the Chromium build that matches the CLI's bundled `playwright-core`, and the "no browser" error of `test` SHALL point to it.

#### Scenario: Fresh machine
- **WHEN** `mcp-apps-studio install-browser` runs
- **THEN** `mcp-apps-studio test` can launch Chromium afterwards

### Requirement: Argument handling
Every subcommand (`start` — the default when the first argument is not a command — `test`, `init`, `add`, `install-browser`) SHALL accept only its documented flags. An unknown command, an unknown flag, a flag without its value or an invalid value SHALL print `error: <reason>` and a hint to run `--help` to stderr and exit `1`. `--help`/`-h` (top level or after a subcommand) and `help [command]` SHALL print usage — commands, their arguments and flags with defaults — to stdout and exit `0`; automation-only flags (`--token`) MUST NOT appear in it. `--version`/`-v` SHALL print the CLI version and exit `0`. Any other failure SHALL print one line `error: <message>` and exit `1`; the stack trace SHALL be printed only when `MCP_APPS_STUDIO_DEBUG=1`.

#### Scenario: Help does not start the server
- **WHEN** `mcp-apps-studio --help` runs
- **THEN** usage listing `test`, `init`, `add` and `install-browser` is printed, no server starts, and the exit code is `0`

#### Scenario: Subcommand help
- **WHEN** `mcp-apps-studio test --help` runs
- **THEN** the `test` flags (`--out`, `--themes`, `--update-snapshots`, `--snapshots`, `--threshold`, `--max-diff-pixels`) are printed and the exit code is `0`

#### Scenario: Version
- **WHEN** `mcp-apps-studio --version` runs
- **THEN** the version from the CLI's `package.json` is printed and the exit code is `0`

#### Scenario: Unknown flag
- **WHEN** `mcp-apps-studio test --theme dark` runs
- **THEN** stderr names `--theme`, suggests `--help`, contains no stack trace, and the exit code is `1`

#### Scenario: Flag without a value
- **WHEN** `mcp-apps-studio test --out` runs
- **THEN** stderr names `--out` and the exit code is `1`

#### Scenario: Misspelled command
- **WHEN** `mcp-apps-studio tset` runs in a directory without a `tset` subdirectory
- **THEN** stderr says `tset` is neither a command nor a directory and the exit code is `1`

### Requirement: Resilient static serving
A read error while serving a studio file (for example the file disappearing during a rebuild) SHALL answer `500` without terminating the server process.

#### Scenario: File removed mid-request
- **WHEN** the file stream for a requested asset emits an error
- **THEN** the response status is `500` and the server keeps answering later requests

### Requirement: Safe artifact paths
Screenshot, baseline and diff paths SHALL be built from widget ids and scenario names sanitized per path segment: characters outside `[A-Za-z0-9._-]` become `_`, and segments `.` and `..` become `_`, so every artifact stays under `--out` and the snapshot directory.

#### Scenario: Scenario name with a traversal
- **WHEN** a story has a scenario named `../../etc/x`
- **THEN** its screenshot path has no `..` segment and resolves inside the output directory

### Requirement: Scenario steps in test runs
When a scenario has `steps`, every `test` run of that scenario SHALL play them in order once the handshake check and settle delay are done, before the run is evaluated and before the screenshot is taken.
- Action steps (`click`, `fill`, `press`) SHALL act on elements inside the widget's iframe. An action that fails within its `timeoutMs` (default 5000) fails the step.
- `expectToolCall` SHALL be satisfied by a widget→host `tools/call` request whose `name` equals the expected name and whose `arguments` contain the expected `arguments` as a deep subset. Objects match key by key, arrays match element by element at equal length, and primitives match by strict equality.
- `expectMessage` SHALL be satisfied by a widget→host request or notification with the expected `method` whose `params` contain the expected `params` as a deep subset.
- Each expectation SHALL consume the earliest matching message in the trace not consumed by an earlier expectation in the same run, including messages sent before the steps started. It SHALL wait up to its `timeoutMs` (default 5000) for one to arrive. Consumed messages SHALL be identified by the trace entry's stable sequence number, so the studio dropping old entries from its capped trace never lets one message satisfy two expectations.
- The first failing step SHALL fail the run with a reason of the form `step <n> (<summary>): <cause>`, and the steps after it SHALL NOT run. For an unmet expectation, the cause SHALL list the messages with that method that were seen, or say that none were seen.
- The run SHALL still be evaluated on the full trace and its screenshot still taken. A run with a failed step MUST NOT update a visual baseline.

#### Scenario: Refresh calls the tool
- **WHEN** a widget calls `get_metrics` on mount and once per Refresh click, and its scenario has `steps: [{ expectToolCall: { name: 'get_metrics' } }, { click: 'button.refresh' }, { expectToolCall: { name: 'get_metrics' } }]`
- **THEN** the run passes

#### Scenario: Broken button
- **WHEN** the same steps run but clicking Refresh sends nothing
- **THEN** the run fails with a reason starting `step 3 (expectToolCall get_metrics)`, because the mount call was consumed by step 1

#### Scenario: Argument subset
- **WHEN** the widget calls `get_rows` with `{ page: 2, size: 20 }` and the step expects `{ name: 'get_rows', arguments: { page: 2 } }`
- **THEN** the expectation is met

#### Scenario: Wrong arguments
- **WHEN** the widget calls `get_rows` with `{ page: 1 }` and the step expects `arguments: { page: 2 }`
- **THEN** the run fails with a reason that starts `step 1 (expectToolCall get_rows)` and quotes the seen arguments `{"page":1}`

#### Scenario: One call satisfies one expectation
- **WHEN** the widget calls `get_metrics` once on load and the steps contain two `expectToolCall get_metrics` with no action between them
- **THEN** the first is met and the second fails after its timeout

#### Scenario: Capped trace
- **WHEN** an expectation consumed a call and the studio then drops older trace entries, shifting that call's position
- **THEN** a second identical expectation does not match that call again

#### Scenario: Missing element stops the steps
- **WHEN** the first step clicks `#nope`, which does not exist, and a second step expects a tool call
- **THEN** the run fails with one step failure naming `step 1 (click #nope)`, the second step is not played, and a screenshot is still saved

#### Scenario: Failed step keeps the baseline
- **WHEN** `--update-snapshots` runs a scenario whose expectation is unmet
- **THEN** no baseline is written for that run
