# ADR-0003: Host profiles instead of a separate `openai-apps` dialect

**Date**: 2026-10-03 (decision taken 2026-09-22, recorded later)
**Status**: accepted
**Deciders**: yani, Claude

## Context

The architecture leaves room for a second `HostAdapter` (`openai-apps`), and the README roadmap
listed one. Since ext-apps 2.0, ChatGPT, Claude, VS Code, Goose and Postman host MCP Apps
natively over the same SEP-1865 wire protocol. What differs between hosts is the environment
(display modes, container size, theme), not the protocol.

## Decision

We do not build a second dialect. Host differences are modelled as host *profiles* on the single
`McpAppsAdapter`: supported display modes, container dimensions, safe area, theme presets.

## Alternatives Considered

### `openai-apps` adapter for `window.openai`
- **Pros**: covers legacy ChatGPT widgets
- **Cons**: a second protocol to maintain and test; a shrinking audience
- **Why not**: the hosts that matter speak MCP Apps; the positioning is widget dev + CI, not legacy compatibility

## Consequences

### Positive
- One adapter, one conformance suite against the official SDK
- Profiles become one more test-matrix axis (scenario × theme × host)

### Negative
- Widgets written only for `window.openai` are not supported

### Risks
- A host diverges from the protocol → revisit with a new ADR that supersedes this one
