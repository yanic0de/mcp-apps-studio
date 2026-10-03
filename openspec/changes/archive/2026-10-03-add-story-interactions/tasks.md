# Tasks

## 1. Schema

- [x] 1.1 `stepSchema` (union of strict verb-keyed objects) and `scenarioSchema.steps` in `packages/shared/src/mocks.ts`, exported from the package index; `mocks.test.ts` covers the four tool-mocks scenarios (accept click+expect, `clik` rejected at `steps.0`, mixed kinds rejected, empty selector rejected)
- [x] 1.2 `Step` type exported from `packages/cli/src/public.ts` (derived from the story schema); `pnpm typecheck` passes and a discovery test shows a story with a misspelled step failing with `scenarios.<name>.steps.0` in the error

## 2. Pure step logic (cli)

- [x] 2.1 `packages/cli/src/steps.ts`: `isSubset(actual, expected)` with object/array/primitive rules; `steps.test.ts` covers nested objects, arrays of equal and unequal length, and primitive mismatch
- [x] 2.2 `matchStep(log, step, consumed)` returning the matched trace index or `undefined`, with earliest-unconsumed semantics for `expectToolCall` (widget→host `tools/call` request) and `expectMessage` (widget→host request or notification); tests cover subset arguments, one call consumed by only one expectation, and host→widget messages ignored
- [x] 2.3 `stepSummary(step)` and `unmetReason(log, step)` (seen arguments/params with that method, cut to 200 chars, or `no <method> seen`); tests pin `expectToolCall get_rows` + `{"page":1}` and `click #nope`

## 3. Run executor

- [x] 3.1 `RunPage.act(step, timeoutMs)` added to the interface; the fake in `run-executor.test.ts` records actions and can fail by selector
- [x] 3.2 Steps phase in `executeRun` after settle: actions through `act`, expectations by polling `getLog()` every 50 ms up to `timeoutMs ?? 5000`, first failure recorded as `step <n> (<summary>): <cause>` and the remaining steps skipped; tests cover a passing click+expect, a missing element that stops later steps with the screenshot still taken, and an unmet expectation
- [x] 3.3 Test that `--update-snapshots` writes no baseline when a step failed (the existing guard, pinned for steps)

## 4. Playwright adapter

- [x] 4.1 `act` in `test-runner.ts` through `page.frameLocator('[data-testid="viewport"] iframe')` (`click`, `fill`, `press` on `on` or `body`) with the step timeout and the error cut to its first line; `pnpm typecheck` passes

## 5. Proof and docs

- [x] 5.1 `refresh` scenario in `packages/components/src/kpi-card/kpi-card.stories.mcp.ts` (click `button.kpi-card__refresh`, two `expectToolCall get_metrics`); `pnpm -F @studio/components build` then `pnpm -F mcp-apps-studio start test ../components` reports 0 failed including `kpi-card/refresh`
- [x] 5.2 e2e in `e2e/tests/story-test.spec.ts`: a temp project whose story expects a tool call the widget never makes fails `test` with exit code 1 and a `step 2 (expectToolCall` reason (step 1 is the click) in `report.json`; `pnpm e2e` passes
- [x] 5.3 README section "Interaction steps" with the kpi-card example, the roadmap item checked off, and `docs/ARCHITECTURE.md` + CLAUDE.md updated (steps phase in `executeRun`, `RunPage.act`)
- [x] 5.4 Minor changeset for `mcp-apps-studio` (`pnpm changeset`)

## 6. Verification

- [x] 6.1 `pnpm openspec validate --all --strict`, `pnpm test`, `pnpm typecheck` and `pnpm lint` all pass
