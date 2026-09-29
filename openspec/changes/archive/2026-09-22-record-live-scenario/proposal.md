# Proposal

## Why

Writing mocks by hand is the slowest part of a story, and hand-written mocks drift from what the server really returns. The live scenario already shows every real `tools/call` and the lifecycle result in the trace; turning that trace into a scenario gives exact, replayable fixtures in one click.

## What Changes

- A "Save scenario" action (available in the `live` scenario) converts the current trace into a scenario: every widget `tools/call` becomes a mock for that tool (last answer wins — `static` with the recorded `content`/`structuredContent`, `error` for `isError`, `rpc-error` for a JSON-RPC error), and the pushed lifecycle becomes the scenario's `toolCall` (`name`, `input`, `result` or `cancelled`).
- The recorded scenario is added to the active widget for this session as `recorded-<n>` and selected, so the widget immediately replays offline.
- A TypeScript snippet of the scenario (ready to paste into `scenarios` of a `*.stories.mcp.ts`) is copied to the clipboard and shown.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `studio-app`: recording a live session as a scenario.

## Impact

- Code: `apps/studio` only (pure `record.ts`, store action, trace panel button). No file writes: the CLI server stays read-only by design.
