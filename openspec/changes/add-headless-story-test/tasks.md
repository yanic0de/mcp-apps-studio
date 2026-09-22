# Tasks

## 1. Studio

- [ ] 1.1 `deep-link.ts` `applyDeepLink(search)` over the store — verify in `deep-link.test.ts`
- [ ] 1.2 App applies the deep link after the manifest loads and installs `window.__mcpStudio` — verify via e2e

## 2. CLI

- [ ] 2.1 `test-plan.ts`: `buildTestPlan`, `evaluateRun`, `summarize` — verify in `test-plan.test.ts`
- [ ] 2.2 `test-runner.ts` with `playwright-core`; `bin` `test` subcommand, exit codes — verify via e2e spawning the CLI on the component library

## 3. Verification

- [ ] 3.1 README + CLAUDE.md command list — verify by reading
- [ ] 3.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`; archive
