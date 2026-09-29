# Iframe Transport

## Purpose

`IframeTransport` is the one place in the core that touches the DOM. It connects `MessageBridge` to a sandboxed iframe via `postMessage`. A sandboxed widget has a null origin, so filtering by origin is impossible; the only trust signal is the event source.

## Requirements

### Requirement: The only trust signal
The transport SHALL accept an incoming `message` event only if `event.source === iframe.contentWindow`. Messages from any other window MUST be ignored without logging.

#### Scenario: Message from another window
- **WHEN** a `message` event arrives with a `source` other than `contentWindow`
- **THEN** transport handlers are not invoked

#### Scenario: Message from the widget
- **WHEN** a `message` event arrives with `source === iframe.contentWindow`
- **THEN** every registered handler receives `event.data`

### Requirement: Sending with targetOrigin '*'
`send` SHALL call `iframe.contentWindow.postMessage(message, '*')`, because the sandbox's null origin matches no concrete origin. If `contentWindow` is missing, the call SHALL be a safe no-op.

#### Scenario: Iframe not mounted yet
- **WHEN** `send` is called while `contentWindow === null`
- **THEN** no exception is thrown

### Requirement: Injectable listening window
The constructor SHALL accept a `ListeningWindow` (default: the global `window`) so the transport can be tested in Node with a fake.

#### Scenario: Node test
- **WHEN** the transport is created with a fake window
- **THEN** subscribe and unsubscribe happen on the fake; the global `window` is not required

### Requirement: Disposal
`dispose()` SHALL remove the listener from the window and clear the handlers; `onMessage` SHALL return an unsubscribe function for that handler.

#### Scenario: Scenario switch in the studio
- **WHEN** Canvas unmounts the iframe and calls `dispose()`
- **THEN** subsequent `message` events do not reach the old bridge

### Requirement: Sandbox without allow-same-origin
The iframe `sandbox` attribute SHALL contain only `allow-scripts`. The value `allow-same-origin` MUST NOT be added: it would give the widget the studio's origin and void the source check.

#### Scenario: Rendering a widget
- **WHEN** Canvas builds the iframe from `adapter.buildIframeEnv()`
- **THEN** `sandbox="allow-scripts"`
