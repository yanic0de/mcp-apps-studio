## ADDED Requirements

### Requirement: New view instance on a new handshake
A `ui/initialize` received after the widget was ready SHALL start a new view instance: the emulator SHALL clear readiness and play the tool lifecycle again after the next `ui/notifications/initialized`. Within one handshake, a repeated `initialized` MUST NOT resend it.

#### Scenario: Frame reloaded by the dev server
- **WHEN** the widget completes the handshake, then sends `ui/initialize` and `initialized` again
- **THEN** it receives `tool-input` a second time
