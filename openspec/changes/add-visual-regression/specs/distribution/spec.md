## ADDED Requirements

### Requirement: GitHub Action
The repository SHALL provide a composite GitHub Action (`action.yml`) with inputs `directory` (default `.`), `version` (default `latest`) and `args` (extra `test` flags) that installs Chromium, runs `mcp-apps-studio test` in `directory`, uploads the output directory as an artifact even on failure, and fails the step when the test fails.

#### Scenario: Using the action
- **WHEN** a workflow uses the action with `directory: widgets`
- **THEN** the job runs every story headlessly, attaches the report and screenshots, and is red on any failed run
