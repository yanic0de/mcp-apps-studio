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
Every story SHALL become a `WidgetManifestEntry`: `id` — the file name without the suffix, `title`, `html` — the contents of the file at `widget` relative to the story, `scenarios` — with `mocks` normalized to `{}` when absent and `toolCall` carried over unchanged when present.

#### Scenario: Scenario without mocks
- **WHEN** a story contains `scenarios: { empty: {} }`
- **THEN** the manifest contains `scenarios.empty === { mocks: {} }`

#### Scenario: Scenario with a tool call
- **WHEN** a story scenario has `toolCall: { name: 'get_data', input: { q: 1 } }`
- **THEN** the manifest scenario carries the same `toolCall`

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
`GET /api/manifest` SHALL rerun discovery on every request (story edits show up on refresh), answer JSON `{ widgets }` with `cache-control: no-store`; a discovery failure SHALL yield `500` with the error text without terminating the process.

#### Scenario: Story being edited
- **WHEN** two consecutive requests are made with a story edited in between
- **THEN** the second response reflects the edit

#### Scenario: Story broken mid-edit
- **WHEN** discovery throws
- **THEN** the status is `500` with the error text
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
`bin` SHALL accept the project root directory, `--port` (default 4400), `--token` (automation only; default random), require a built studio and print the URL with the token. With no stories it SHALL say the demo widget will be shown.

#### Scenario: Studio not built
- **WHEN** the studio's `dist/index.html` is missing
- **THEN** the process exits with the hint `pnpm -F @studio/app build`

### Requirement: add subcommand
`add <name> [--dir <dir>]` SHALL copy the component's files from `registry.json` into `<dir>/<name>/` (default `src/components`) and remind about the `@studio/widget-runtime` dependency. An unknown name SHALL yield an error listing the available components.

#### Scenario: Unknown component
- **WHEN** `add nope` runs
- **THEN** the error lists `kpi-card` and `data-table`
