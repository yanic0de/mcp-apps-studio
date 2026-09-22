# distribution Specification

## Purpose
Defines what MCP Apps Studio publishes to npm and how a release is proven installable, so the tool can be used outside this monorepo with `npx`.

## Requirements

### Requirement: Published packages
The repository SHALL publish exactly `mcp-apps-studio` (CLI) and `@mcp-apps-studio/widget-runtime`. The runtime dependency fields of their published manifests (`dependencies`, `peerDependencies`, `optionalDependencies`) MUST NOT reference `workspace:` versions or unpublished `@studio/*` packages, and SHALL point `exports`/`bin`/`types` at built JavaScript and declarations.

#### Scenario: Packed manifest
- **WHEN** the CLI package is packed
- **THEN** its `package.json` has `bin.mcp-apps-studio` pointing into `dist` and no dependency on a `@studio/*` package

### Requirement: Installable from tarballs
A pack smoke test SHALL install the packed tarballs into an empty project containing one widget HTML file, run `mcp-apps-studio init <widget>` and then `mcp-apps-studio test`, and succeed only if both exit `0` and `report.json` lists the scaffolded scenarios.

#### Scenario: Fresh project
- **WHEN** the smoke test runs on a clean machine with Chromium installed
- **THEN** the generated story's non-live scenarios pass for both themes

### Requirement: Continuous integration
CI SHALL run lint, typecheck and unit tests on Linux, macOS and Windows, and e2e plus the pack smoke test on Linux, for every push and pull request. Releases SHALL go through changesets.

#### Scenario: Pull request
- **WHEN** a pull request is opened
- **THEN** all CI jobs run and a failure blocks the check

### Requirement: Current SDK generation
The published packages SHALL target the current major of `@modelcontextprotocol/ext-apps` (2.x) and the MCP SDK v2 packages: `@mcp-apps-studio/widget-runtime` SHALL declare `@modelcontextprotocol/ext-apps` `^2` and `@modelcontextprotocol/client` `^2` as peers, and the repository MUST NOT depend on `@modelcontextprotocol/sdk`.

#### Scenario: Installing with the SDK's own instructions
- **WHEN** a project installs `@modelcontextprotocol/ext-apps @modelcontextprotocol/client zod` (latest) and `@mcp-apps-studio/widget-runtime`
- **THEN** npm reports no unmet peer dependency for widget-runtime
