# Spec Delta: cli

## ADDED Requirements

### Requirement: Argument handling
Every subcommand (`start` — the default when the first argument is not a command — `test`, `init`, `add`, `install-browser`) SHALL accept only its documented flags. An unknown command, an unknown flag, a flag without its value or an invalid value SHALL print `error: <reason>` and a hint to run `--help` to stderr and exit `1`. `--help`/`-h` (top level or after a subcommand) and `help [command]` SHALL print usage — commands, their arguments and flags with defaults — to stdout and exit `0`; automation-only flags (`--token`) MUST NOT appear in it. `--version`/`-v` SHALL print the CLI version and exit `0`. Any other failure SHALL print one line `error: <message>` and exit `1`; the stack trace SHALL be printed only when `MCP_APPS_STUDIO_DEBUG=1`.

#### Scenario: Help does not start the server
- **WHEN** `mcp-apps-studio --help` runs
- **THEN** usage listing `test`, `init`, `add` and `install-browser` is printed, no server starts, and the exit code is `0`

#### Scenario: Subcommand help
- **WHEN** `mcp-apps-studio test --help` runs
- **THEN** the `test` flags (`--out`, `--themes`, `--update-snapshots`, `--snapshots`, `--threshold`, `--max-diff-pixels`) are printed and the exit code is `0`

#### Scenario: Version
- **WHEN** `mcp-apps-studio --version` runs
- **THEN** the version from the CLI's `package.json` is printed and the exit code is `0`

#### Scenario: Unknown flag
- **WHEN** `mcp-apps-studio test --theme dark` runs
- **THEN** stderr names `--theme`, suggests `--help`, contains no stack trace, and the exit code is `1`

#### Scenario: Flag without a value
- **WHEN** `mcp-apps-studio test --out` runs
- **THEN** stderr names `--out` and the exit code is `1`

#### Scenario: Misspelled command
- **WHEN** `mcp-apps-studio tset` runs in a directory without a `tset` subdirectory
- **THEN** stderr says `tset` is neither a command nor a directory and the exit code is `1`

## MODIFIED Requirements

### Requirement: bin entry point
`bin` SHALL accept the project root directory (default the current directory; it MUST exist and be a directory), `--port` (default 4400; an integer from 1 to 65535), `--token` (automation only; at least 32 characters from `[A-Za-z0-9_-]`; default random), locate the built studio — first in the `studio` directory next to the running CLI module (installed package), then in the workspace `@studio/app` build (development) — and print the URL with the token. With no stories it SHALL say the demo widget will be shown. When the port is taken it SHALL print that the port is in use and suggest `--port`, and exit `1`.

#### Scenario: Studio not built
- **WHEN** the CLI runs from the workspace and neither location has `index.html`
- **THEN** the process exits `1` with the hint `pnpm -F @studio/app build`

#### Scenario: Installed package without studio assets
- **WHEN** the CLI runs from an installed package whose `dist/studio` is missing and no workspace package exists
- **THEN** the process exits `1` telling the user to reinstall `mcp-apps-studio`, without a stack trace

#### Scenario: Installed package
- **WHEN** the CLI runs from its published `dist`
- **THEN** it serves the studio bundled in `dist/studio` without any workspace package

#### Scenario: Port out of range
- **WHEN** `mcp-apps-studio --port 70000` runs
- **THEN** stderr names `--port` and the exit code is `1`

#### Scenario: Port in use
- **WHEN** another process listens on 127.0.0.1:4400 and `mcp-apps-studio` starts with the default port
- **THEN** stderr says port 4400 is already in use and suggests `--port`, and the exit code is `1`

#### Scenario: Weak token
- **WHEN** `mcp-apps-studio --token abc` runs
- **THEN** stderr names `--token` and the exit code is `1`
