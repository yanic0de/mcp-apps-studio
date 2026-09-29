# Spec Delta: studio-app

## MODIFIED Requirements

### Requirement: Automation hook
The studio SHALL expose `window.__mcpStudio.getLog()` returning the current trace entries and `window.__mcpStudio.getActive()` returning `{ widget, scenario, theme }` of what the canvas renders (`widget` is `null` when no widget is loaded); the hook MUST NOT allow changing studio state.

#### Scenario: Reading the trace
- **WHEN** an automation script calls `window.__mcpStudio.getLog()` after the widget loaded
- **THEN** it receives entries including `ui/initialize`

#### Scenario: Reading the rendered target
- **WHEN** the studio shows widget `table`, scenario `empty` in dark theme and `getActive()` is called
- **THEN** it returns `{ widget: 'table', scenario: 'empty', theme: 'dark' }`

#### Scenario: Unknown deep link is visible
- **WHEN** the studio is opened with `?widget=ghost` and `getActive()` is called
- **THEN** `widget` is not `ghost`
