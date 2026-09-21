# MCP Apps Protocol (SEP-1865)

## Purpose

The single source of truth for the wire level of the MCP Apps extension: protocol version, UI resource MIME type, JSON-RPC method names and their parameter schemas. Every other package takes these values from `packages/shared/src/protocol.ts`; when the spec evolves, only this file changes.

## Requirements

### Requirement: Protocol version and resource MIME type
The `@studio/shared` package SHALL export the protocol version constant `2026-01-26` and the UI resource MIME type `text/html;profile=mcp-app`, and every place that needs these values (the `ui/initialize` result, resource discovery in live mode) SHALL use the constants rather than literals.

#### Scenario: Initialize result carries the version
- **WHEN** the widget sends `ui/initialize`
- **THEN** the `protocolVersion` field of the result equals `MCP_APPS_PROTOCOL_VERSION`

#### Scenario: Widget discovery by MIME
- **WHEN** the studio in live mode lists the server's resources
- **THEN** the widget resource is the one whose `mimeType` equals `MCP_APPS_RESOURCE_MIME`

### Requirement: Method names in one place
Wire method names SHALL live only in the `MCP_APPS_METHODS` object: widget → host — `ui/initialize`, `tools/call`, `resources/read`, `ui/notifications/size-changed`; host → widget — `ui/notifications/host-context-changed`, `ui/notifications/tool-input`. Code outside `protocol.ts` MUST NOT contain these strings as literals.

#### Scenario: A method is renamed in the spec
- **WHEN** a method name changes in a new SEP-1865 version
- **THEN** changing the value in `MCP_APPS_METHODS` is sufficient
- **AND** the adapter, the widget client and the tests keep referring to the same field

### Requirement: Method parameter schemas
The package SHALL provide zod parameter schemas: `tools/call` — `{ name: non-empty string, arguments?: unknown }`; `resources/read` — `{ uri: non-empty string }`; `size-changed` — `{ width?: number, height?: number }`.

#### Scenario: Empty tool name
- **WHEN** `tools/call` params contain `name: ""`
- **THEN** `toolsCallParamsSchema.safeParse` fails

#### Scenario: Size with one dimension missing
- **WHEN** `size-changed` params contain only `height`
- **THEN** the schema accepts them and `width` stays `undefined`

### Requirement: Widget follow-up messages are not implemented from memory
The adapter MUST NOT contain a method for widget follow-up messages until its wire name is confirmed by the real `@modelcontextprotocol/ext-apps` SDK.

#### Scenario: Widget sends an unknown method
- **WHEN** the widget sends a request with a method absent from `MCP_APPS_METHODS`
- **THEN** the host answers with a `METHOD_NOT_FOUND` error instead of guessing the semantics
