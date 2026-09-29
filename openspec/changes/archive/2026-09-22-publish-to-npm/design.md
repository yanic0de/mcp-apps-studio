# Design

## Context

Workspace packages export TS source and depend on each other with `workspace:*`. The CLI resolves the studio via `require.resolve('@studio/app/package.json')` and the registry via `@studio/components`. Component sources are copied verbatim into user projects by `add`, so their import specifier must be a real published package name.

## Goals / Non-Goals

**Goals:** `npx mcp-apps-studio init && npx mcp-apps-studio` works in an empty project; one install, no workspace references in published manifests; a CI job proves it from tarballs on every PR.

**Non-Goals:** publishing internal packages (`shared`, `host-emulator`, `app`, `components`) — they are bundled into the CLI; standalone binaries; a docs site.

## Decisions

1. **Bundle internals into the CLI with tsup** (`noExternal: [/^@studio\//]`), keep `esbuild` and `playwright-core` as real dependencies (native binaries / large). Declarations are bundled too, so `import { defineWidgetStory } from 'mcp-apps-studio'` type-checks without internal packages.
2. **Assets inside the CLI package**: `dist/studio/` (built SPA) and `dist/registry/` (registry.json + listed component files) are copied by the build. `assets.ts` looks next to the running module first, then falls back to the workspace packages, so `pnpm -F mcp-apps-studio start` keeps working from source.
3. **`publishConfig`** overrides `exports`/`bin`/`types` to `dist`, so development keeps TS-source exports and the published manifest points at builds.
4. **widget-runtime peers**: `@modelcontextprotocol/ext-apps`, `@modelcontextprotocol/sdk`, `zod` required peers; `react` optional peer (main entry is React-free). Duplicate SDK copies would break `instanceof`/event wiring.
5. **Scope `@mcp-apps-studio`** for libraries, unscoped `mcp-apps-studio` for the CLI (`npx`-friendly). Both names were free on 2026-09-22.
6. **Pack smoke test** (`scripts/pack-smoke.mjs`): builds, `pnpm pack`s both packages, installs the tarballs with npm into a temp project containing a vanilla widget, runs `mcp-apps-studio init` then `mcp-apps-studio test`, asserts exit 0 and a report. It is the definition of "installable".

## Risks / Trade-offs

- [Package size: studio build + playwright-core] → playwright-core is ~9 MB but needed by `test`; browsers are not downloaded on install.
- [Windows path handling] → unit tests run on Windows in CI.
- [Name confusion with the unrelated `mcp-app-studio` package] → owner decision; documented.
