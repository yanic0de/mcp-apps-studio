# Spec Delta: host-emulator

## ADDED Requirements

### Requirement: Resource teardown
`teardown({ timeoutMs })` (default 500 ms) SHALL, when the widget completed the handshake and the emulator is running, send the adapter's teardown request (`ui/resource-teardown` with `params: {}` for MCP Apps), wait for the response or the timeout, and then stop the emulator. Without a completed handshake it SHALL stop immediately. It MUST NOT reject.

#### Scenario: SDK widget acknowledges
- **WHEN** a widget built on the SDK `App` with an `onteardown` handler is torn down
- **THEN** the handler runs, the emulator receives the response and is stopped

#### Scenario: Silent widget
- **WHEN** the widget never answers the teardown request
- **THEN** `teardown()` resolves after the timeout and the emulator is stopped

#### Scenario: Before the handshake
- **WHEN** `teardown()` is called before `ui/notifications/initialized`
- **THEN** nothing is sent and the emulator is stopped
