# Design

## Context

`RpcLogEvent`s carry full wire payloads and ids; widget requests and host responses correlate by id. Lifecycle notifications (`tool-input`, `tool-result`, `tool-cancelled`) are logged host → widget. The tool name of the lifecycle is not on the wire, but the studio knows it (the live linked tool).

## Goals / Non-Goals

**Goals:** a pure, unit-tested `recordScenario(log, toolName?)`; one click from live session to an offline scenario.

**Non-Goals:** writing story files from the browser (would need a write endpoint on the local server — deliberately not added); recording per-argument variants (last answer per tool wins); persisting recorded scenarios across reloads.

## Decisions

- **Pure conversion from the trace**, not a recorder hooked into the passthrough: the trace is already the single record of what the widget saw, including capped history; no second data path.
- **Last answer per tool wins**: mocks are keyed by tool name only (tool-mocks spec); argument-dependent mocks are a separate feature.
- **`validate` before adding**: the result goes through `scenarioSchema`, so a recording can never produce a scenario the CLI would reject.
- **Snippet** is `JSON.stringify(scenario, null, 2)` — valid TS object literal, no codegen library.

## Risks / Trade-offs

- [The trace is capped at 500 entries] → very long sessions record only the recent window; acceptable for fixtures.
- [Clipboard API may be unavailable] → the snippet is also shown in the panel.
