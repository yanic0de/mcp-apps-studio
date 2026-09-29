# Proposal: prepare-public-release

## Why

The engineering is ready for a first `0.1.0`, but the public surface is not:

- **npm.** The CLI's npm page would be empty (no README in the package), and neither tarball carries the license text.
- **Package metadata.** The manifests point at the old `mcp-app-proba` repository and still declare Node 20, which is end-of-life. CI only tests Node 22.
- **Release.** The workflow publishes without running a single check.
- **GitHub Action.** It can only be referenced as `@main`, so users get whatever lands on main.
- **Changelog.** The pending changesets describe migrations (ext-apps 1.x → 2.x, …) that no user ever went through.
- **README.** It is out of date:
  - it imports a private package;
  - it calls shipped features "Planned";
  - it gives monorepo commands where users need `npx`;
  - it has no picture of the tool.
- **Community files.** There are no contributing, security or conduct files.

## What Changes

- **Tarballs.** Both published tarballs contain `README.md` and a `LICENSE` identical to the repository's; the pack smoke test checks this.
  - `packages/cli/README.md` is new: quickstart, commands, story format, CI.
- **Manifests.** Both published manifests declare:
  - `repository`, `homepage` and `bugs` on `github.com/yanic0de/mcp-apps-studio`;
  - `author`;
  - `engines.node` `>=22`.
  The monorepo root declares the same engine, and `.nvmrc` pins 22.
- **Release gate.** `release.yml` runs lint, typecheck, unit tests and the pack smoke test before `changeset publish`. After a publish it moves the `v<major>` tag (`v0` for now), so users can pin the Action to `yanic0de/mcp-apps-studio@v0`. The changelog uses `@changesets/changelog-github` (PR and author links).
- **Changesets.** The pending ones are collapsed into a single `first-release.md` describing what 0.1.0 is.
- **Docs.**
  - README is rewritten for users: accurate commands, screenshots, a security notes section (sandbox, token, the Vite plugin's `null`-origin trade-off), troubleshooting, and a comparison with MCP Inspector, MCPJam and Storybook.
  - Contributor material moves to `CONTRIBUTING.md` and a new `docs/ARCHITECTURE.md`.
- **Community files.**
  - `SECURITY.md` (threat model; reports via GitHub private vulnerability reporting).
  - `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
  - Issue forms (bug, feature) and a PR template.
- **Cleanup.**
  - `docs/superpowers/plans/` is deleted; it is stale, and git history keeps it.
  - `.gitignore` gains `.env*`.

The repository itself must be renamed on GitHub by the owner (Settings → Rename). GitHub redirects the old URLs.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `distribution`:
  - `Published packages`: README, LICENSE, metadata, engines.
  - `Installable from tarballs`: the smoke test checks README/LICENSE, `--version` and typo handling.
  - `Continuous integration`: the release is gated on checks and uses a GitHub changelog.
  - `GitHub Action`: a `v<major>` tag is moved on release, and docs pin to it.

## Impact

- **Files:**
  - Manifests: `packages/cli/package.json`, `packages/widget-runtime/package.json`, root `package.json`, `tsup` targets (`node22`).
  - Workflows: `.github/workflows/release.yml`, `.changeset/*`.
  - Scripts: `scripts/pack-smoke.mjs`.
  - Docs: README, new docs files, `docs/assets/*.png` (screenshots generated from the real studio and report).
- **New devDependency:** `@changesets/changelog-github`.
- **Owner actions (outside the repo):**
  - rename the repository;
  - enable private vulnerability reporting;
  - add the `NPM_TOKEN` secret before the first release.
