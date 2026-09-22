## MODIFIED Requirements

### Requirement: Manifest from stories
Every story SHALL become a `WidgetManifestEntry`: `id` — the file name without the suffix, `title`, `html` — the contents of the file at `widget` relative to the story, `scenarios` — with `mocks` normalized to `{}` when absent and `toolCall` carried over unchanged when present.

#### Scenario: Scenario without mocks
- **WHEN** a story contains `scenarios: { empty: {} }`
- **THEN** the manifest contains `scenarios.empty === { mocks: {} }`

#### Scenario: Scenario with a tool call
- **WHEN** a story scenario has `toolCall: { name: 'get_data', input: { q: 1 } }`
- **THEN** the manifest scenario carries the same `toolCall`
