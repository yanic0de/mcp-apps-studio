# Proposal

## Why

`mcp-apps-studio test` only proves a widget renders: handshake, no invalid messages, optional visual diff. It cannot check what a widget *does*: that pressing Refresh calls `get_metrics`, or that "Next page" sends `get_rows` with `{ page: 2 }`. That behavior is the bug class that reaches users, and checking it in CI is the "Playwright" half of the product positioning.

## What Changes

- A scenario gains optional `steps`, an ordered list that runs after the handshake:
  - actions inside the widget: `{ click: selector }`, `{ fill: selector, value }`, `{ press: key, on?: selector }`;
  - expectations on the trace: `{ expectToolCall: { name, arguments? } }` and `{ expectMessage: { method, params? } }`. Expected `arguments`/`params` are a subset match. Each expectation consumes the earliest widget message that matches and was not already matched, and waits up to `timeoutMs` (default 5000).
- `mcp-apps-studio test` plays the steps in every run of that scenario. The first failing step fails the run with a reason that names the step and stops the steps after it. The run evaluation (invalid messages) covers the whole trace, and the screenshot is taken after the steps.
- `kpi-card` in the component library gets a `refresh` scenario with steps, used as the end-to-end proof.
- The public `Step` type is exported from `mcp-apps-studio`. The README gets a short section.
- Not in this change: a step player in the studio UI, recording clicks (a sandboxed null-origin iframe gives the studio no view of DOM events), snapshot steps, and per-call sequences or argument matching in mocks (a separate change).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tool-mocks`: the scenario schema accepts a validated `steps` list.
- `cli`: `test` plays scenario steps and fails runs on unmet expectations or failed actions.

## Impact

- `packages/shared/src/mocks.ts`: `stepSchema` and `scenarioSchema.steps`.
- `packages/cli`: a pure step matcher, `run-executor.ts` (steps phase), `test-runner.ts` (Playwright actions through the widget iframe's frame locator), and the `Step` type in `public.ts`.
- `packages/components/src/kpi-card/kpi-card.stories.mcp.ts`: the new `refresh` scenario.
- The studio ignores `steps`: it renders the scenario as before. Its automation hook stays read-only.
- No new dependencies. No change to the wire protocol, the bridge or the sandbox.
