# sdk-conformance Specification

## Purpose
Guarantees that widgets built on the official `@modelcontextprotocol/ext-apps` `App` client work in the studio exactly as the SDK expects a host to behave, by running that client against the emulator in the test suite.

## Requirements

### Requirement: Official client handshake
The test suite SHALL connect an ext-apps `App` to a `HostEmulator` over an in-memory transport, and the connection SHALL succeed with the host context delivered to the app and no `invalid` trace events.

#### Scenario: Connect
- **WHEN** `app.connect(transport)` is awaited against the emulator with theme `dark`
- **THEN** `app.getHostContext().theme === 'dark'`
- **AND** `app.getHostCapabilities()` includes `openLinks` and `serverTools`
- **AND** the emulator reports `isReady() === true`

### Requirement: Official client flows
Through the same connection, `callServerTool`, `openLink`, `sendMessage`, `updateModelContext`, `requestDisplayMode`, `sendLog` and host-context change events SHALL complete without errors and with results the SDK accepts.

#### Scenario: Tool call with structured content
- **WHEN** the app calls a tool mocked with `structuredContent: { v: 1 }`
- **THEN** the resolved result has `structuredContent.v === 1`

#### Scenario: Tool error result
- **WHEN** the app calls a tool mocked with `kind: 'error'`
- **THEN** the resolved result has `isError: true` instead of a rejected promise

#### Scenario: Display mode request
- **WHEN** the app requests `fullscreen`
- **THEN** it resolves with `{ mode: 'fullscreen' }` and the app's `hostcontextchanged` handler receives `displayMode: 'fullscreen'`

#### Scenario: Intents
- **WHEN** the app calls `openLink`, `sendMessage` and `updateModelContext`
- **THEN** each resolves without error and the emulator's intent callback receives the matching actions
