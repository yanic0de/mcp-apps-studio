# Tasks

## 1. Package contents and metadata

- [x] 1.1 `package-meta.test.ts`: both published manifests have repository/homepage/bugs on `yanic0de/mcp-apps-studio`, `author`, `engines.node >=22`; `LICENSE` in each package equals the root one; `README.md` exists in each — verify it fails first
- [x] 1.2 Copy LICENSE into both packages; update manifests (+ root `engines`, `.nvmrc` 22, tsup `target: node22`); write `packages/cli/README.md` (npm manual) and refresh `packages/widget-runtime/README.md` links — verify `package-meta.test.ts` passes
- [x] 1.3 `pack-smoke.mjs`: fail when a tarball lacks `package/README.md` or `package/LICENSE` — verify `pnpm smoke:pack` passes, and fails when README is temporarily moved away

## 2. Release pipeline

- [x] 2.1 `workflows.test.ts`: `release.yml` runs lint/typecheck/test/smoke:pack before the changesets step, and a step gated on `published` moves the major tag without `${{` in `run` — verify it fails first
- [x] 2.2 `release.yml` gate steps + Chromium install + `id: changesets` + major-tag step; `@changesets/changelog-github` in `.changeset/config.json`; collapse pending changesets into one `first-release.md` — verify `workflows.test.ts` passes and `pnpm changeset status` lists one changeset

## 3. Documentation

- [x] 3.1 `scripts/screenshots.mjs` → `docs/assets/studio-light.png`, `studio-dark.png`, `trace.png`, `report-diff.png` — verify files exist and each is < 300 KB
- [x] 3.2 README rewrite for users (hero + screenshots, quickstart with `npx`, story format, CI with `@v0`, security notes incl. the Vite plugin trade-off, troubleshooting, comparison, links to CONTRIBUTING/ARCHITECTURE; no private-package imports, no stale "Planned") — verify `git grep -n "@studio/host-emulator\|mcp-app-proba\|Planned" README.md` is empty
- [x] 3.3 `docs/ARCHITECTURE.md`, `CONTRIBUTING.md` (setup, commands, TDD, changesets, OpenSpec flow, release checklist incl. owner actions), `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/{bug.yml,feature.yml,config.yml}`, `.github/pull_request_template.md`; delete `docs/superpowers/plans/`; `.gitignore` `.env*`; CLAUDE.md points to the new docs — verify issue forms parse (`workflows.test.ts`-style YAML parse) and links in README resolve to existing files

## 4. Wrap-up

- [x] 4.1 `pnpm openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm smoke:pack` all green
