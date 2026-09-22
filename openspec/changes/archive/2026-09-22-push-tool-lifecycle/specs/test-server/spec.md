## ADDED Requirements

### Requirement: Inspector shows the tool lifecycle
The inspector SHALL print every `tool-input-partial`, `tool-input`, `tool-result` and `tool-cancelled` notification it receives, in a lifecycle log separate from the button output.

#### Scenario: Live call of the linked tool
- **WHEN** the studio plays the linked tool in live mode
- **THEN** the inspector's lifecycle log contains `tool-input` and `tool-result`
