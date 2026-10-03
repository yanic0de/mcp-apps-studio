# Contributing

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Setup

You need Node 22 (see `.nvmrc`) and pnpm through corepack:

```bash
corepack enable
git clone https://github.com/yanic0de/mcp-apps-studio.git
cd mcp-apps-studio
pnpm install
```

Try it:

```bash
pnpm -F @studio/app dev                 # studio with a built-in demo widget → http://localhost:5173
pnpm -F @studio/example-server dev      # reference MCP server on :3100 (pick the "live" scenario)
pnpm -F @studio/test-server dev         # protocol polygon on :3200 → ?server=http://localhost:3200/mcp
pnpm -F @studio/components build        # bundle library widgets (needed by their stories)
pnpm -F mcp-apps-studio start ../components   # the CLI from source, over the component library
```

Both reference servers listen on `127.0.0.1`. Set `HOST=0.0.0.0` to expose them, for example in a container.

## Checks

```bash
pnpm test          # vitest (Node, no jsdom)
pnpm typecheck     # tsc per package
pnpm lint          # biome: format + lint + import order (pnpm lint:fix for safe fixes)
pnpm e2e           # Playwright, Chromium only; starts vite, both servers and the CLI
pnpm smoke:pack    # pack, install the tarballs in a temp project, run init + test
```

CI runs lint, typecheck and unit tests on Linux, macOS and Windows, and runs e2e and the pack smoke test on Linux.

## How changes are made

- **Tests first.** For each step: write a failing test, make it pass, run `pnpm lint`, then commit. Tests sit next to the source (`src/*.test.ts`).
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(cli): …`, `fix(host-emulator): …`).
- **Changesets.** A PR that changes published behavior (`mcp-apps-studio` or `@mcp-apps-studio/widget-runtime`) needs `pnpm changeset`.
- **Specs.** Behavior is specified in [`openspec/specs/`](openspec/specs/), one spec per capability.
  - A behavior change updates the matching spec in the same PR. Typo fixes and pure refactors don't need a spec change.
  - Larger changes start as a proposal under `openspec/changes/<id>/` (proposal, spec deltas, design, tasks), get implemented, and are then archived. If you use Claude Code, the `/opsx:propose`, `/opsx:apply` and `/opsx:archive` commands automate this. It is optional; the files are plain Markdown.
  - Run `pnpm openspec validate --all --strict` after editing anything under `openspec/`.
- **Architecture.** Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), especially "Constraints that are easy to violate", before touching the host core or the CLI server.
- **Decisions.** An architectural choice with real alternatives (and anything that outlives one OpenSpec change) gets a record in [docs/adr/](docs/adr/).
- **Biome rules.** Suppress one only with a `biome-ignore` comment that states the reason.

Things we deliberately don't do: a server-inspector UI (LLM chat, OAuth), a docs site, and Tailwind. Open an issue first if you want to argue for one.

## Releasing (maintainers)

Releases go through [changesets](https://github.com/changesets/changesets):

1. On `main`, the release workflow runs lint, typecheck, tests and the pack smoke test.
2. It opens a "Version packages" PR.
3. Merging that PR publishes both packages to npm and moves the `v<major>` tag that the GitHub Action is pinned to.

**Publishing uses npm Trusted Publishing (OIDC):** there is no npm token in the repository, and every version gets a provenance attestation. Each package needs a trusted publisher configured once on npmjs.com:

1. Open the package page (`mcp-apps-studio`, then `@mcp-apps-studio/widget-runtime`) → **Settings** → **Trusted Publisher** → **GitHub Actions**.
2. Organization or user: `yanic0de`. Repository: `mcp-apps-studio`. Workflow filename: `release.yml`. Environment: leave empty.
3. Once both packages have it, delete the `NPM_TOKEN` repository secret and revoke the token on npmjs.com.

Before a release, regenerate the README screenshots if the UI changed: `node scripts/screenshots.mjs`. This needs the studio and components built, and Chromium.

`pnpm changeset version` uses the GitHub changelog generator and needs `GITHUB_TOKEN` when run locally. CI provides it.
