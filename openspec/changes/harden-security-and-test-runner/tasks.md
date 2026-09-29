# Tasks

## 1. Protocol and host core

- [x] 1.1 `protocol.ts`: `ui/open-link` accepts only http/https/mailto URLs; raise shared's zod range to `^4.4.3` — verify new cases in `protocol.test.ts` (javascript:, data: rejected; https, mailto accepted) and `sdk-conformance.test.ts` still green
- [ ] 1.2 `HostEmulator.setHostContext`: merge always, notify only when handshake done and running; diff vs the context sent in `ui/initialize` delivered right after `initialized` — verify new `host-emulator.test.ts` cases (before handshake, during handshake, after stop, no-diff → no notification) and existing theme-change case

## 2. `test` runner

- [ ] 2.1 `test-plan.ts`: `checkTarget(run, active)` returns failure reasons for a widget/scenario/theme mismatch — verify `test-plan.test.ts`
- [ ] 2.2 Studio `automation.ts`: `createAutomationHook(getState)` with `getLog()` + `getActive()`; `App.tsx` installs it — verify `automation.test.ts` (rendered target, unknown deep link not reported as requested)
- [ ] 2.3 `run-executor.ts`: `executeRun(page, run, ctx)` over a duck-typed `RunPage`; never throws, closes the page in `finally`, applies the target check, handshake evaluation, screenshot, snapshot policy (baseline only when ok) and visual compare — verify `run-executor.test.ts` with a fake page (goto throws → failed result + page closed; failing run under update → no baseline; target mismatch → failure; happy path unchanged)
- [ ] 2.4 `test-runner.ts` uses `executeRun` with a Playwright page adapter; reports always written — verify `pnpm e2e` story-test spec green and `test` on `packages/components` exits 0

## 3. CLI `add`

- [ ] 3.1 `addComponent(name, dir, { force })` returns `{ copied, skipped }` via `COPYFILE_EXCL`; `bin.ts` `add` supports `--force`, lists skipped files, prints the unknown-name error without a stack and exits 1 — verify `add.test.ts` (re-add keeps edits, `--force` replaces) and a manual `pnpm -F mcp-apps-studio start add nope` exit code 1

## 4. Reference servers

- [ ] 4.1 example-server and test-server `main.ts`: bind `HOST` (default `127.0.0.1`), print the real address; bump `hono` past the audited advisories — verify new `main.test.ts` in each package (spawn with `PORT=0`, host is 127.0.0.1, `/health` ok) and `pnpm audit --prod` no longer lists hono

## 5. Action and CI supply chain

- [ ] 5.1 `workflows.test.ts` in `packages/cli` (devDependency `yaml`): SHA-pinned `uses:`, top-level `permissions` in workflows, no `${{` in `run:`, hostile `STUDIO_VERSION` rejected by the action's validation script — verify it fails against the current files
- [ ] 5.2 `action.yml` inputs via `env:` + version validation step + `set -f` args; pin all actions in `action.yml` and `.github/workflows/*` by SHA (`gh api`), `ci.yml` `permissions: contents: read`; renovate `helpers:pinGitHubActionDigests` — verify `workflows.test.ts` passes

## 6. Wrap-up

- [ ] 6.1 Changeset (patch, `mcp-apps-studio`); README notes for `add --force` and the servers' `HOST`; CLAUDE.md mentions `run-executor` and `getActive()` — verify by reading the diff
- [ ] 6.2 `pnpm openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm smoke:pack` all green
