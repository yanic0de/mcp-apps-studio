# Design

## Context

A test run (`executeRun` in `packages/cli/src/run-executor.ts`) drives the studio through a duck-typed `RunPage` (`goto`, `waitForLog`, `settle`, `getLog`, `getActive`, `screenshotViewport`). `test-runner.ts` adapts Playwright to it, and unit tests use a fake. The trace comes from the read-only `window.__mcpStudio.getLog()`. The widget lives in a sandboxed `allow-scripts` iframe inside `[data-testid="viewport"]`. Scenarios are typed and validated by `scenarioSchema` in `@studio/shared`, which reaches `test` unchanged through discovery and the manifest.

## Goals / Non-Goals

**Goals:**
- All step logic (matching, consuming, failure text) is pure and runs in node. Only "perform this action" reaches the browser.
- The run flow stays as it is: steps add one phase between settle and evaluation.

**Non-Goals:**
- Driving the widget from the studio UI, or giving the automation hook write access. The hook stays read-only.
- Retrying, branching or looping steps.

## Decisions

1. **Steps live on the scenario, in `@studio/shared`.** They describe what the scenario does, they are validated at discovery like mocks (a typo fails discovery with a path), and `Step` in `public.ts` derives from the schema like the other story types. The alternative was a separate `tests` block on the story. That would duplicate the mocks a test needs, and stories already are the unit of the test matrix.

2. **Steps are a union of strict objects keyed by their verb (`{ click: '…' }`), not `{ kind: 'click', … }`.** This reads like the Playwright and Testing Library calls users already write, and strict objects reject mixed or misspelled steps. The cost is a less precise zod error than a discriminated union gives. A test pins the error path to `steps.<n>`, which is enough to find the typo.

3. **Expectations are checked in node by polling `getLog()` (every 50 ms up to `timeoutMs`), not with `waitForFunction` in the page.** Matching is then a pure function (`matchStep(log, step, consumed)`) unit-tested against literal traces, and the browser side needs nothing beyond the existing hook. The cost is roughly 50 ms of latency per expectation, which is negligible next to the settle delay.

4. **Consumption across the whole trace, earliest unconsumed match first, keyed by the trace entry's `seq`.** The studio caps its trace at 500 entries and drops the oldest, which shifts indexes, so consumption is remembered by the entry's monotonic `seq` (already on every studio trace entry), not by its position. A widget that calls its tool on mount (before the steps start) is matched by the first expectation, and a second identical expectation needs a second call. "Only messages after the previous action" was rejected: it would miss calls that race with the click, the classic flake.

5. **`RunPage` gains one method, `act(step, timeoutMs)`.** The Playwright adapter resolves it through `page.frameLocator('[data-testid="viewport"] iframe')` with `click`, `fill` and `press`. `press` without `on` goes to the frame's `body`. Playwright reaches the null-origin frame through CDP, so the sandbox attributes and the `IframeTransport` trust check stay untouched. Errors are cut to their first line for the reason text.

6. **Failure text comes from the step's summary.** Examples: `click #nope`, `expectToolCall get_rows`, `expectMessage ui/open-link`. Unmet expectations list the arguments or params of the messages seen with that method (cut to 200 chars each), or say `no <method> seen`. The report already prints failure strings, so HTML, JSON and the job summary need no change.

7. **The proof is in the component library.** `kpi-card` gets a `refresh` scenario: `click button.kpi-card__refresh`, then `expectToolCall get_metrics` twice (mount, then refresh). The existing e2e that runs `test ../components` covers it for real, and a misbehaving step would fail that e2e.

## Risks / Trade-offs

- [The widget re-renders and detaches the clicked element] → Playwright locators re-resolve and auto-wait. Steps use selectors, never handles.
- [Default timeouts make a failing matrix slow] → a failed step stops the run's remaining steps, and `timeoutMs` per step lets users tighten them.
- [A union with no discriminator gives noisy errors] → covered by the schema test on the error path (Decision 2). Moving to a discriminated union later would be a breaking schema change, so the verb-keyed shape is fixed now.
- [Steps in the `live` scenario] → `live` is already excluded from the plan, so its steps are ignored. This is documented, not rejected.

## Migration Plan

Additive: existing stories without `steps` behave exactly as before. It ships as a minor changeset for `mcp-apps-studio`.
