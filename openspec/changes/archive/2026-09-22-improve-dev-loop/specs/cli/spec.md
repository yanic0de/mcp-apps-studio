## MODIFIED Requirements

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

### Requirement: Manifest on demand
`GET /api/manifest` SHALL rerun discovery on every request, answer JSON `{ widgets, errors }` with `cache-control: no-store`; only an unexpected failure outside story loading SHALL yield `500` with the error text, without terminating the process.

#### Scenario: Story being edited
- **WHEN** two consecutive requests are made with a story edited in between
- **THEN** the second response reflects the edit

#### Scenario: Story broken mid-edit
- **WHEN** a story throws while loading
- **THEN** the status is `200`, the story is listed in `errors`
- **AND** the next `/` request answers `200`

## ADDED Requirements

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
