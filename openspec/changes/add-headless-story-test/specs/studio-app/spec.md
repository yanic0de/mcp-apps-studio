## ADDED Requirements

### Requirement: Deep links
After the manifest loads, the studio SHALL apply the URL parameters `widget` (widget id), `scenario`, `theme`, `display` and `device` to the initial state; a value that does not name an existing widget/scenario or a valid option SHALL be ignored.

#### Scenario: Open a scenario directly
- **WHEN** the studio is opened with `?scenario=error&theme=dark`
- **THEN** the `error` scenario is selected and the host context theme is `dark`

#### Scenario: Unknown scenario
- **WHEN** the studio is opened with `?scenario=nope`
- **THEN** the first scenario stays selected

### Requirement: Automation hook
The studio SHALL expose `window.__mcpStudio.getLog()` returning the current trace entries; the hook MUST NOT allow changing studio state.

#### Scenario: Reading the trace
- **WHEN** an automation script calls `window.__mcpStudio.getLog()` after the widget loaded
- **THEN** it receives entries including `ui/initialize`
