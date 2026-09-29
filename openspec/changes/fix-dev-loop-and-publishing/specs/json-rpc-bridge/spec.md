# Spec Delta: json-rpc-bridge

## ADDED Requirements

### Requirement: No unhandled failures
The bridge MUST NOT produce unhandled promise rejections or throw into its caller because of a message: an exception from the notification handler, or from the transport while answering a request or sending a notification, SHALL be recorded as an `invalid` trace event naming the method and the error.

#### Scenario: Throwing notification handler
- **WHEN** `onNotification` throws for an incoming notification
- **THEN** the trace gets an `invalid` event with that error and no unhandled rejection occurs

#### Scenario: Unsendable response
- **WHEN** the transport throws while the bridge sends a response
- **THEN** the trace gets an `invalid` event and the bridge keeps serving later requests

#### Scenario: Unsendable notification
- **WHEN** the transport throws in `notify`
- **THEN** `notify` returns normally and the trace gets an `invalid` event
