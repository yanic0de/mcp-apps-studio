# Proposal: improve-cli-arguments

## Why

`mcp-apps-studio` is the first thing a new user touches, and its argument handling is hand-rolled in one 200-line script:

- `--help` starts the server.
- There is no `--version`.
- A mistyped subcommand (`mcp-apps-studio tset`) is taken as a project directory and ends in a raw `ENOENT` stack.
- Unknown flags are ignored silently, and flags missing their value silently fall back to defaults.
- `--port 70000` is accepted, and a busy port crashes with an unhandled `EADDRINUSE`.
- An installed package with missing studio assets crashes resolving a workspace package that does not exist outside the monorepo, and the hint it would print (`pnpm -F @studio/app build`) only makes sense inside the monorepo.
- `--token` accepts any string, even a one-character token.

These must be fixed before the first public release.

## What Changes

- **Parsing.** Arguments are parsed strictly per subcommand (`start` — the default — plus `test`, `init`, `add`, `install-browser`). An unknown command, an unknown flag, a missing flag value or an invalid value prints `error: …` plus a one-line usage hint to stderr and exits `1`, with no stack trace.
- **`--help` / `-h`.** At the top level, and after a subcommand, it prints usage and exits `0`. `mcp-apps-studio help [command]` does the same.
- **`--version` / `-v`.** Prints the CLI version and exits `0`.
- **Project directory.** The positional `[dir]` of `start` and `test` must be an existing directory. A word that is not a command and not a directory reads as "unknown command or directory".
- **`--port`.** It must be an integer from 1 to 65535. A busy port prints `port <n> is already in use — pass --port <other>` and exits `1`.
- **`--token`.** It must be at least 32 characters from `[A-Za-z0-9_-]`. It stays out of `--help` (automation only).
- **Missing studio assets.** This no longer crashes. The installed package says to reinstall; the monorepo says `pnpm -F @studio/app build`.
- **Unexpected errors.** Any other error prints one line (`error: <message>`) and exits `1`. With `MCP_APPS_STUDIO_DEBUG=1` the full stack is printed as well.

Nothing breaks for valid invocations. Invocations that relied on silently ignored flags now fail loudly, which is intended.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cli`:
  - `bin entry point` is modified: directory, port and token validation, the busy-port message, and missing-assets messages for the installed package and the monorepo.
  - A new requirement, `Argument handling`, covers every subcommand: strict flags, help, version, and one-line errors.

## Impact

- **Code:**
  - `packages/cli/src/bin.ts` becomes a small dispatcher.
  - New `packages/cli/src/args.ts`: pure parsing plus help texts.
  - `packages/cli/src/assets.ts` reports missing assets instead of throwing.
  - `packages/cli/src/server.ts` gets a `listen` helper that turns `EADDRINUSE` into a typed error.
- **Tests:** new `args.test.ts` and `bin.test.ts` (spawns the CLI), plus additions to `assets.test.ts` and `server.test.ts`.
- **Dependencies:** none. `node:util` `parseArgs` is stable in Node 20.
- **Docs:** README CLI section, CLAUDE.md, and a changeset (patch).
