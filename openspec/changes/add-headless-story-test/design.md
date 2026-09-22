# Design

## Context

The CLI already builds the manifest and serves the studio (`createStudioServer`); e2e already proves the studio works under Playwright. The missing pieces are a way to put the studio into a given state from the URL and a way to read the trace from outside without scraping the DOM.

## Goals / Non-Goals

**Goals:** a CI-friendly smoke test of all stories with protocol checks and screenshots; pure, unit-tested planning and evaluation.

**Non-Goals:** pixel diffing against baselines (screenshots are artifacts; diffing is a follow-up); `live` scenarios (need a running server); display-mode and device axes (URL supports them; the matrix stays scenario × theme to keep runs fast).

## Decisions

- **Deep links instead of clicking the UI.** The runner navigates to `/?token=…&widget=…&scenario=…&theme=…`; the studio applies them once after the manifest loads. Also useful to share a studio state.
- **`window.__mcpStudio.getLog()`** is the only automation surface: read-only, returns the trace entries. The runner polls it for `ui/notifications/initialized`, then waits a short settle (300 ms) before the screenshot so delayed/`loading` scenarios are captured in their loading state.
- **`playwright-core`** rather than `@playwright/test`: a library, not a test runner; browsers are installed by the user once. Missing browser → clear message, exit 2.
- **Pure `test-plan.ts`**: `buildTestPlan(manifest, themes)`, `evaluateRun(log)` → `{ ok, failures }`, `summarize(results)`. The runner is a thin shell around them and is covered by one e2e case.
- **Each run gets a fresh page**, so state never leaks between runs.

## Risks / Trade-offs

- [Handshake timeout for slow widgets] → 10 s per run, reported as a failure with the reason.
- [Screenshots differ across machines] → artifacts only; no diffing yet.
