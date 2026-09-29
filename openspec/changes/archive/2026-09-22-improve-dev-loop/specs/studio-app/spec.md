## ADDED Requirements

### Requirement: Dev-server widgets
For a manifest entry with `url`, Canvas SHALL render the iframe from `adapter.buildIframeEnv({ kind: 'dev', url })` (`src`, same sandbox), so the dev server's own HMR runs inside the widget.

#### Scenario: Widget from Vite
- **WHEN** the active widget's entry is `{ url: 'http://localhost:5173/' }`
- **THEN** the iframe `src` is that URL with `sandbox="allow-scripts"`

### Requirement: Live reload
When served by the CLI, the studio SHALL subscribe to `/api/events`; on a `manifest` event it SHALL reload the manifest, keep the selected widget and scenario when they still exist, and remount the widget.

#### Scenario: Scenario data edited
- **WHEN** the mocked value in the active scenario is changed in the story file
- **THEN** the widget shows the new value without a manual refresh, in the same scenario

### Requirement: Discovery errors banner
The studio SHALL show discovery `errors` (file and message) in a banner above the canvas while they exist.

#### Scenario: Broken story
- **WHEN** the manifest has an error for `broken.stories.mcp.ts`
- **THEN** the banner names that file and the working widgets stay usable
