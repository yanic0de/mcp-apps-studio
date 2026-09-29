# Spec Delta: cli

## MODIFIED Requirements

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

## ADDED Requirements

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
