# Tasks

## 1. Conversion

- [ ] 1.1 `record.ts`: `recordScenario(log, toolName?)` and `scenarioSnippet` — verify in `record.test.ts` (static, isError, rpc-error, lifecycle result/cancelled, last-wins, schema-valid)

## 2. Studio

- [ ] 2.1 Store `addScenario(name, scenario)` on the active widget, returns the unique `recorded-<n>` name — verify in `store.test.ts`
- [ ] 2.2 Trace panel "Save scenario" in live mode: add + select + copy snippet + show it — verify via e2e against the example server

## 3. Verification

- [ ] 3.1 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`; archive
