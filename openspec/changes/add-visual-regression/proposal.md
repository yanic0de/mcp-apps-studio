# Proposal

## Why

`mcp-apps-studio test` checks protocol hygiene and saves screenshots, but nothing compares them: a widget can break visually (dark theme, empty state, loading skeleton) and CI stays green. Visual regression per story × theme is what makes the "Playwright" half of the positioning real, and teams adopt it through CI — a ready GitHub Action with a readable report is the entry point.

## What Changes

- `test --update-snapshots` writes the screenshots as baselines to the snapshot directory (`--snapshots <dir>`, default `mcp-studio-snapshots/` in the project root).
- When the snapshot directory exists, each run is compared to its baseline with a per-pixel diff (`--threshold`, default `0.1`; `--max-diff-pixels`, default `0`). A mismatch, a size change or a missing baseline fails the run and writes `<name>.diff.png` next to the actual screenshot. Without a snapshot directory, visual checks are off (opt-in).
- `report.html` in the output directory: every run with status and reasons; failed visual runs show baseline, actual and diff side by side.
- When `GITHUB_STEP_SUMMARY` is set, a Markdown summary table is appended to it.
- `action.yml` (composite GitHub Action): installs Chromium, runs `npx mcp-apps-studio test` in the given directory, uploads the output as an artifact, fails the job on failures.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cli`: snapshot baselines, visual comparison, HTML report, job summary.
- `distribution`: the GitHub Action.

## Impact

- Code: `packages/cli` (visual.ts, report.ts, test-plan/runner/bin), `action.yml`, e2e, docs.
- Dependencies: `pixelmatch` (ISC) and `pngjs` (MIT) in the CLI.
- Baselines are platform-sensitive (fonts, antialiasing): generate them where CI runs; the Action runs on Linux.
