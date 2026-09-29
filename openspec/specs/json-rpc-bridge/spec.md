# JSON-RPC Bridge

## Purpose

`MessageBridge` is the transport-independent JSON-RPC 2.0 layer on the host side. It validates every incoming message (the widget is untrusted code), routes requests and notifications, correlates responses to host-originated requests through the shared `RequestTracker`, and emits trace events. The `Transport` abstraction (`send`, `onMessage`) lets the bridge be tested in Node with an in-memory transport pair.

## Requirements

### Requirement: Classification and validation of incoming messages
The bridge SHALL pass every incoming message through `parseJsonRpcMessage`, distinguishing a request (`method` and `id` present), a notification (`method` present, no `id`) and a response (`result` or `error` present). An invalid message SHALL land in the trace with `kind: 'invalid'` and a readable reason without interrupting the bridge.

#### Scenario: Garbage from the widget
- **WHEN** the widget sends `{ evil: true }` followed by a valid request
- **THEN** an `invalid` event appears in the trace
- **AND** the valid request is handled and answered

#### Scenario: Wrong jsonrpc field
- **WHEN** a message lacks `jsonrpc: "2.0"`
- **THEN** it is classified as invalid with the reason `missing or invalid "jsonrpc" field`

### Requirement: Handling widget requests
The bridge SHALL pass a request to `onRequest` and reply `{ jsonrpc, id, result }` on success. A thrown `RpcError` SHALL become `{ error: { code, message, data? } }` with its code; any other error becomes code `INTERNAL_ERROR` (-32603) with the exception text. A response MUST NOT be sent if the bridge was stopped while handling.

#### Scenario: Successful request
- **WHEN** the widget sends a request with `id: 7` and `onRequest` returns `{ echoed: 'tools/call' }`
- **THEN** the widget receives `{ jsonrpc: '2.0', id: 7, result: { echoed: 'tools/call' } }`

#### Scenario: Protocol error
- **WHEN** `onRequest` throws `RpcError(METHOD_NOT_FOUND, 'no such method')`
- **THEN** the widget receives a response with `error.code === -32601` and the same message

#### Scenario: Stopped while handling
- **WHEN** `stop()` is called before `onRequest` completes
- **THEN** no response is sent to the transport

### Requirement: Host-to-widget requests
The bridge SHALL assign host requests ids of the form `h<n>` via `RequestTracker`, reject them on timeout (default 30 000 ms) with `REQUEST_TIMEOUT` (-32001), and match incoming responses by `id`. A response with an unknown or `null` id SHALL be logged as `invalid`.

#### Scenario: Widget response resolves the promise
- **WHEN** the host calls `request('ping')` and the widget answers `{ id, result: 'pong' }`
- **THEN** the promise resolves with `'pong'`

#### Scenario: Timeout
- **WHEN** the widget does not answer within `requestTimeoutMs`
- **THEN** the promise rejects with an `RpcError` of code `REQUEST_TIMEOUT`

#### Scenario: Send failure
- **WHEN** `transport.send` throws
- **THEN** the request promise rejects with that exception instead of hanging until the timeout

### Requirement: Stopping the bridge
`stop()` SHALL unsubscribe from the transport and reject all pending host requests with `INTERNAL_ERROR` and the text `bridge stopped`. A subsequent `start()` SHALL subscribe again.

#### Scenario: Pending request at stop
- **WHEN** the host sent `request('ping')` and called `stop()` before the answer
- **THEN** the promise rejects with an `RpcError`
- **AND** subsequent widget messages are not handled

### Requirement: Trace events
The bridge SHALL call `onLog` for every message with `ts`, `direction` (`widget→host` | `host→widget`), `kind` (`request` | `notification` | `response` | `invalid`), `method`/`id` where applicable and the full `payload`. The time source SHALL be injectable (`now`).

#### Scenario: Request-response pair
- **WHEN** the widget sends a request and receives a response
- **THEN** the trace contains exactly `[widget→host request, host→widget response]` in that order

### Requirement: Shared request correlation
Request correlation (id allocation, timeout, settle on response, bulk rejection) SHALL be implemented once in `RequestTracker` from `@studio/shared` and used by both the bridge and the widget client. New "pending request map" implementations MUST NOT appear.

#### Scenario: Error response
- **WHEN** the tracker receives `{ id, error: { code, message, data } }` for a known id
- **THEN** the matching promise rejects with an `RpcError` carrying that `code`, `message`, `data`

#### Scenario: Settling an already settled request
- **WHEN** the tracker receives a second response for the same id
- **THEN** `settle` returns `false` and changes nothing

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
