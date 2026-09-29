# Proposal

## Why

The positioning is "Storybook + Playwright for MCP Apps widgets", and adoption starts with `npx`. Today every package is `private`, exports TypeScript source, and the CLI only runs inside this monorepo after building the studio by hand. Nobody outside the repo can try the tool.

## What Changes

- Two published packages:
  - `mcp-apps-studio` — the CLI with the built studio and the component registry inside; workspace code bundled; `defineWidgetStory` + story types for `*.stories.mcp.ts`.
  - `@mcp-apps-studio/widget-runtime` (renamed from `@studio/widget-runtime`) — ESM + type declarations; SDK and React as peer dependencies so apps share one `App` class.
- The CLI finds the studio and the registry next to itself when installed, and falls back to the workspace packages in development.
- New `mcp-apps-studio init [widget.html…]` scaffolds a `*.stories.mcp.ts` next to each widget (`default`, `loading`, `error`, `live`).
- Release tooling: changesets (private workspace packages ignored), a pack smoke test that installs the tarballs into an empty project and runs `init` + `test`, GitHub Actions CI (lint, typecheck, unit tests on Linux/macOS/Windows; e2e and pack smoke on Linux) and a release workflow, Renovate grouping the MCP SDKs.
- **BREAKING** component sources import `@mcp-apps-studio/widget-runtime`.

## Capabilities

### New Capabilities
- `distribution`: what gets published, how it installs, and how releases are verified.

### Modified Capabilities
- `cli`: bundled studio/registry resolution; `init` subcommand.
- `component-library`: registry dependency name.

## Impact

- Code: `packages/cli` (build, asset resolution, init), `packages/widget-runtime` (rename, build), `packages/components` (imports, registry), root (changesets, scripts), `.github/`, `renovate.json`.
- Supersedes the MVP cut "changesets" (decided with the positioning).
- Publishing itself needs the npm org `mcp-apps-studio` and an `NPM_TOKEN` secret — owner actions, not code.
