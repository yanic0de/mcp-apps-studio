# Design

## Context

- **Packing.** Published manifests come from `publishConfig`. `files: ["dist"]` controls the tarball, but npm always adds `README*` and `LICENSE*` from the package directory, so both files must sit in `packages/cli/` and `packages/widget-runtime/`.
- **Smoke test.** `scripts/pack-smoke.mjs` already extracts each tarball, which makes it the natural place for content checks.
- **Release.** `release.yml` runs `changesets/action` with `publish: pnpm release` (`pnpm build && changeset publish`).

## Goals / Non-Goals

**Goals:**
- A newcomer lands on the README or the npm page, understands the tool in one screen, and gets to a passing `test` in five minutes.
- Nothing is published unless the same checks as CI pass.

**Non-Goals:**
- A docs site. This is a deliberate cut: README, `docs/ARCHITECTURE.md` and `--help` are enough for 0.1.
- npm trusted publishing (OIDC). npm only lets you configure a trusted publisher on a package that already exists, so the first release uses `NPM_TOKEN` with provenance. Switching to OIDC is a documented follow-up in CONTRIBUTING.
- A demo GIF. Screenshots come first; a GIF can follow from the same Playwright script.
- Fixing the Vite plugin's `null`-origin trade-off. It is documented prominently here; the fix is its own change.

## Decisions

- **LICENSE copies are committed, not generated.**
  - Copies in both packages are guarded by a unit test (`packages/cli/src/package-meta.test.ts`) that compares them byte for byte with the root file. The same test checks the manifest metadata.
  - Considered and rejected: a `prepack` script. It is invisible in the repo, and it does not run for every packer (`pnpm pack` vs `changeset publish` differ in lifecycle handling).
- **The CLI README is written for npm, not copied from the root.**
  - The root README is the project page (why, screenshots, comparison, contributing).
  - The package README is the tool manual: install, commands, story format, CI, a link back.
  - Duplication is limited to the quickstart block.
- **Release gate in the same job.** Lint, typecheck, test and `smoke:pack` run as steps before `changesets/action`. That needs Playwright Chromium (`pnpm exec playwright install --with-deps chromium`) in the release job, as the CI pack-smoke job does. Considered and rejected: `workflow_run` on CI success. It is more moving parts, and the token context differs.
- **Major tag.**
  - `changesets/action` exposes `outputs.published`.
  - A following step (`if: steps.changesets.outputs.published == 'true'`) reads the CLI version from `packages/cli/package.json`, then runs `git tag -f v<major>` and `git push -f origin v<major>`.
  - It needs `contents: write`, which the release job already has.
  - The version is read from the file, not interpolated into the script, so the no-`${{`-in-`run` lint still holds.
- **Changelog generator.**
  - Use `@changesets/changelog-github` with `repo: yanic0de/mcp-apps-studio`.
  - It needs `GITHUB_TOKEN` during `changeset version`, which the action already provides.
  - Local `pnpm changeset version` without a token fails, which only concerns the maintainer. This is documented in CONTRIBUTING.
- **Screenshots from the real product.**
  - A small script, `scripts/screenshots.mjs`, reuses the built studio plus the CLI server (like the e2e config) and Playwright to capture:
    - the studio with the component library (light and dark);
    - the trace panel expanded;
    - a `report.html` with a visual diff.
  - They are written to `docs/assets/`. Committed PNGs stay under 300 KB each (1280×800, `deviceScaleFactor: 1`).
  - Considered and rejected: hand-made mockups. They drift from the product.
- **Contributor docs.**
  - `docs/ARCHITECTURE.md` takes the human-facing parts of CLAUDE.md: layering, trust model, the constraints that are easy to violate, and the test strategy. CLAUDE.md stays for AI agents.
  - `CONTRIBUTING.md` covers setup (corepack, Node 22), commands, TDD and changesets, and the optional OpenSpec `/opsx:*` flow explained in plain words.
- **Changesets collapsed.** One `first-release.md`, minor for both packages (fixed group → `0.1.0`). It summarizes the product, not its history.

## Risks / Trade-offs

- [The repository rename has not happened when the links ship] → GitHub redirects renames one way (old → new) only after the rename. The owner renames before merging; CONTRIBUTING's release checklist lists it first.
- [Screenshots go stale] → the script is rerunnable (`node scripts/screenshots.mjs`) and is listed in CONTRIBUTING under "before a release".
- [The release job gets slower (Chromium, smoke)] → about 3 extra minutes on a rare event. Acceptable.
- [`engines >=22` blocks Node 20 users] → Node 20 is end-of-life and untested in CI. npm only warns (no `engine-strict`), so it is a clear signal rather than a hard block.

## Migration Plan

Owner actions before the first release, in order:
1. Rename the repo to `mcp-apps-studio`.
2. Enable private vulnerability reporting.
3. Add the `NPM_TOKEN` secret.
4. Merge the "Version packages" PR.
