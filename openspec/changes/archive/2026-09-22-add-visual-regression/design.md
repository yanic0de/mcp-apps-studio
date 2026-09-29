# Design

## Context

The runner already produces `<out>/<widget>/<scenario>.<theme>.png` per run after a 300 ms settle, with a fresh page per run and a fixed 1280×900 viewport.

## Goals / Non-Goals

**Goals:** opt-in, deterministic-enough visual checks; a report a reviewer can read without tooling; one-line CI adoption.

**Non-Goals:** cross-platform baselines (documented: generate on the CI platform); per-story thresholds (global flags first); PR comments (needs tokens/permissions; the job summary + artifact cover review).

## Decisions

- **Opt-in by presence of the snapshot directory**: projects that never ran `--update-snapshots` see no new failures; once baselines are committed, missing ones fail (like Playwright), so new stories cannot silently skip.
- **pixelmatch** (`threshold` per-pixel YIQ tolerance, `maxDiffPixels` count) over byte equality: PNG encoders and subpixel noise differ run to run.
- **Size mismatch = failure** with both sizes in the reason, no diff image (pixelmatch needs equal sizes).
- **Pure compare + report modules** (`visual.ts`, `report.ts`) unit-tested with generated PNGs; the runner only wires them.
- **Relative image paths in report.html** so the uploaded artifact renders offline.
- **Composite action** (no Docker, no JS action build): `actions/setup-node` is left to the caller; the action runs `npx --yes mcp-apps-studio@<version>` (default `latest`) and `upload-artifact`.

## Risks / Trade-offs

- [Flaky pixels from transitions/caret] → settle before capture; `--threshold`/`--max-diff-pixels` escape hatches.
- [Baselines generated on macOS failing on Linux CI] → README tells users to update snapshots via CI or a Linux container.
