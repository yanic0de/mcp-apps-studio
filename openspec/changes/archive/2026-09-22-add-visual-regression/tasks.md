# Tasks

## 1. Comparison and report

- [x] 1.1 `visual.ts`: compare actual vs baseline (missing, size, pixel count, diff image) — verify `visual.test.ts` with generated PNGs
- [x] 1.2 `report.ts`: `report.html` + Markdown summary — verify `report.test.ts`

## 2. Runner and CLI

- [x] 2.1 Runner: update/compare per run; bin flags; job summary — verify via e2e (update → pass → change → fail with diff)

## 3. Action and docs

- [x] 3.1 `action.yml` composite action; README CI section; CLAUDE.md; changeset — verify YAML parses
- [x] 3.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm smoke:pack`; archive
