# ADR-0002: Story interaction steps are verb-keyed and matched against the trace in Node

**Date**: 2026-10-03
**Status**: accepted
**Deciders**: yani, Claude

## Context

`mcp-apps-studio test` proved only that a widget renders. Checking behaviour ("Refresh calls
`get_metrics`") needs steps in stories. The widget is sandboxed with a null origin, the studio's
automation hook is read-only, and the trace is capped at 500 entries. Details: OpenSpec change
`add-story-interactions`.

## Decision

A scenario's `steps` are verb-keyed strict objects (`{ click }`, `{ fill, value }`, `{ press, on? }`,
`{ expectToolCall }`, `{ expectMessage }`). Actions run through Playwright's frame locator;
expectations are matched by pure Node code against the polled trace, each consuming the earliest
unconsumed match, remembered by the trace entry's `seq`.

## Alternatives Considered

### Discriminated union `{ kind: 'click', … }`
- **Pros**: precise zod errors
- **Cons**: reads unlike Playwright/Testing Library; more typing in every story
- **Why not**: strict verb-keyed objects already reject typos and mixed steps; error path `steps.<n>` is enough

### Matching inside the page with `waitForFunction`
- **Pros**: no polling latency
- **Cons**: matching logic serialised into the browser, untestable in Node
- **Why not**: ~50 ms per expectation is negligible; pure functions are tested against literal traces

### Only messages after the previous action count
- **Pros**: intuitive
- **Cons**: misses calls racing the click
- **Why not**: the classic flake; a mount call is consumed explicitly instead

## Consequences

### Positive
- Behaviour tests in CI without touching the sandbox or the read-only hook
- Failure reasons quote what the widget actually sent

### Negative
- Switching to a discriminated union later is a breaking schema change

### Risks
- The trace cap drops an unconsumed match before it is checked → only with >500 messages between
  steps; consumption by `seq` keeps a dropped-and-shifted entry from being rematched
