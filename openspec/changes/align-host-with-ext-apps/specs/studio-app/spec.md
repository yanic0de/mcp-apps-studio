## MODIFIED Requirements

### Requirement: Tool errors in live mode
In live mode the studio SHALL forward the server's `CallToolResult` to the widget unchanged, including `isError: true` results. Only transport or protocol failures SHALL become a JSON-RPC error, keeping the MCP error code when the client exposes one and `INTERNAL_ERROR` otherwise.

#### Scenario: The fail tool
- **WHEN** the server answers `isError: true` with the text `Intentional failure`
- **THEN** the widget receives a result with `isError: true` and that text in `content`

#### Scenario: Structured data
- **WHEN** the server answers with `content` and `structuredContent`
- **THEN** the widget receives both

## ADDED Requirements

### Requirement: Widget-initiated context changes
When the emulator reports a context change initiated by the widget (e.g. an accepted display-mode request), the studio SHALL store that context so the controls reflect it, and MUST NOT send the same change back to the widget.

#### Scenario: Widget goes fullscreen
- **WHEN** the widget requests `fullscreen` and the emulator accepts it
- **THEN** the "Display" control shows `fullscreen`
- **AND** the trace has exactly one `host-context-changed` for that change
