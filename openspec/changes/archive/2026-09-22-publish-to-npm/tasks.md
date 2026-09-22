# Tasks

## 1. widget-runtime package

- [x] 1.1 Rename to `@mcp-apps-studio/widget-runtime` across the repo (imports, registry, docs) — verify `pnpm typecheck && pnpm test`
- [x] 1.2 tsup build (index + react, ESM + d.ts), peers, `publishConfig`, `files` — verify `pnpm pack` contents

## 2. CLI package

- [x] 2.1 `assets.ts`: studio/registry lookup next to the module, workspace fallback — verify `assets.test.ts`
- [x] 2.2 `init` subcommand (`init.ts`) — verify `init.test.ts` (scaffold loads via discovery, no overwrite, auto-find)
- [x] 2.3 tsup build bundling `@studio/*`, copy `dist/studio` + `dist/registry`, `publishConfig` — verify packed manifest has no `@studio/*`

## 3. Release tooling

- [x] 3.1 `scripts/pack-smoke.mjs` + `pnpm smoke:pack` — verify it passes locally
- [x] 3.2 changesets config + initial changeset; `.github/workflows/ci.yml`, `release.yml`; `renovate.json` — verify YAML parses and `changeset status` works

## 4. Wrap-up

- [x] 4.1 README install section (`npx mcp-apps-studio init`), CLAUDE.md commands/constraints — verify by reading
- [x] 4.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`; archive
