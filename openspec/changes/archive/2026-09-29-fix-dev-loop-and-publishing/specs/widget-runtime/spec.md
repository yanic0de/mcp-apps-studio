# Spec Delta: widget-runtime

## ADDED Requirements

### Requirement: Failed handshake cleanup
When `connectWidget` fails to connect, it SHALL remove the host-context listener it added, close the `App` (closing its transport), and reject with the original error.

#### Scenario: Transport cannot start
- **WHEN** the transport's `start()` rejects with `no parent window`
- **THEN** `connectWidget` rejects with that error and the transport's `close()` was called
