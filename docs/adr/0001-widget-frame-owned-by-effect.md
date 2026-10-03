# ADR-0001: The widget iframe is owned by an effect, not rendered from JSX

**Date**: 2026-10-03
**Status**: accepted
**Deciders**: yani, Claude

## Context

A real host sends `ui/resource-teardown` before it removes a widget and waits for the answer.
The studio rendered the iframe as `<iframe key={widget:scenario:revision}>` and called
`emulator.teardown()` in the effect cleanup. React removes a keyed element during the mutation
phase, before effect cleanups run, so the request was posted to a detached frame
(`contentWindow === null`) and never delivered. The trace showed it anyway.

## Decision

Canvas's frame effect creates the iframe with `document.createElement` from
`adapter.buildIframeEnv()`, appends it to an always-mounted viewport, and on cleanup hides and
renames the outgoing frame (`title="retiring widget"`, `display: none`), sends teardown, and
removes the frame only after the answer or the 500 ms timeout.

## Alternatives Considered

### Ref callback cleanup
- **Pros**: runs before React removes the node
- **Cons**: removal follows in the same synchronous commit; a posted message is dropped with the frame
- **Why not**: the widget never gets to run its handler, let alone answer

### `useLayoutEffect` cleanup
- **Pros**: earlier than passive effects
- **Cons**: deletions are still committed before the parent's layout cleanups
- **Why not**: same detached frame

### Render outgoing frames from state (a "retiring" list)
- **Pros**: stays declarative
- **Cons**: the outgoing frame is only known after React has removed it; needs a pre-commit hook in every store action
- **Why not**: more moving parts for the same result

## Consequences

### Positive
- Teardown is delivered and answered, as on real hosts (e2e checks the widget's response)
- A resize no longer touches the frame's lifecycle: size is applied by a separate effect

### Negative
- One imperative DOM island in a React app; attributes from `buildIframeEnv` must be applied by hand

### Risks
- Two frames coexist for ≤500 ms → the retiring one is hidden, `aria-hidden` and renamed, so
  `iframe[title="widget under test"]` (e2e, `test` runner, screenshots) always means one frame
