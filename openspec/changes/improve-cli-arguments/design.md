# Design

## Context

`packages/cli/src/bin.ts` runs top to bottom:

- Each subcommand is an `if (args[0] === …)` block with its own `for` loop over `args`.
- Validation is ad hoc, and errors escape as unhandled top-level-await rejections.
- `locateAssets` falls back to `require.resolve('@studio/app/package.json')`, which throws outside the monorepo.
- `server.listen` has no `'error'` listener.

## Goals / Non-Goals

**Goals:**
- Parsing that can be unit-tested without spawning a process.
- One place where commands, flags and help text are defined.
- Spawn tests that pin the exit codes and streams users see.

**Non-Goals:**
- An argument-parsing library such as commander or yargs. `node:util` `parseArgs` is enough, and the CLI bundle should stay small.
- Colors, shell completion, config files.
- Subcommand aliases, and an explicit `start` command word. `start` stays the default, as documented.
- `test` flags like `--grep`/`--reporter`. Those belong to a later change.

## Decisions

- **`args.ts` is pure.**
  - `parseCli(argv: string[]): Cli` returns one of `{ kind: 'help', text }`, `{ kind: 'version' }`, `{ kind: 'error', message }`, or `{ kind: 'run', command }`. `command` is a discriminated union: `start`, `test`, `init`, `add`, `install-browser`, each with typed, validated options.
  - It wraps `parseArgs({ strict: true, allowPositionals: true, options })` for each command and turns its `ERR_PARSE_ARGS_*` errors into messages that name the flag.
  - Numbers (`--port`, `--threshold`, `--max-diff-pixels`), the `--themes` list and `--token` are validated here.
  - It does no I/O, so every rule is a table-driven unit test.
  - Considered and rejected: keeping per-block loops with more checks. That duplicates flag handling five times and still can't be tested without spawning.
- **Help text sits next to the option tables.** Each command entry holds its usage line, a description and the flag list, so help cannot drift from what the parser accepts. `--token` carries `hidden: true`.
- **Command vs directory.** When `argv[0]` is not a known command and does not start with `-`, it is the `start` project dir. `bin.ts` then checks it with `fs.statSync(...).isDirectory()`. When it is missing and contains no path separator, the message is ``error: `tset` is neither a command nor a directory (see --help)``. Otherwise the message is `directory not found: <path>`. The same check applies to `test [dir]`. This is I/O, so it lives in `bin.ts` as a small exported `resolveProjectDir(arg, cwd)`, tested with temp dirs.
- **Version** comes from `createRequire(import.meta.url)('../package.json').version`. That resolves from both `src/` (dev) and `dist/` (installed), since both sit one level below the package root. The pack smoke test already runs the installed bin, so it will cover this.
- **Assets.**
  - `locateAssets(moduleUrl, resolveWorkspace?)` gets an injectable workspace resolver.
  - It returns `{ studioDist, registryRoot, source: 'bundled' | 'workspace' | 'missing' }`, catching the resolver's `MODULE_NOT_FOUND`.
  - `resolveStudioDist()` in `bin.ts` picks the message by `source`: `missing` means reinstall; `workspace` without `index.html` means `pnpm -F @studio/app build`.
- **Port.** `listenLoopback(server, port): Promise<number>` in `server.ts` resolves with the bound port. It rejects with `PortInUseError(port)` on `EADDRINUSE` and with the original error otherwise. `bin.ts` catches `PortInUseError` and prints the friendly line. The test occupies a port with a throwaway `net.Server`.
- **Errors.**
  - `bin.ts` wraps dispatch in `main().catch(report)`. `report` prints `error: <message>` (plus the stack when `MCP_APPS_STUDIO_DEBUG=1`) and sets `process.exitCode = 1`.
  - Known outcomes (`NoBrowserError` → exit 2) keep their exit codes.
  - `process.exit` is only used after output is flushed, as today.
- **Spawn tests (`bin.test.ts`).**
  - They run `node --import tsx src/bin.ts …` from `packages/cli` with a 10 s timeout, the same approach as the server `main.test.ts`.
  - Cases: `--help`, `test --help`, `--version`, an unknown flag, a missing value, a misspelled command, `--port 70000`, a weak token, and a busy port (the port is occupied first, then `--port <it>` is passed).
  - The pure rules stay in `args.test.ts`, so the spawn set stays small.

## Risks / Trade-offs

- [Strict parsing breaks someone passing an unknown flag today] → pre-1.0, no release yet. The error message points to `--help`.
- [`parseArgs` treats `--out --themes` as `--out` with value `--themes`] → a value that starts with `-` is rejected for path/number options with "`--out` needs a value".
- [Spawn tests are slow on Windows CI] → about 9 spawns at under 1 s each. Worth it, because exit codes and streams are the contract.
- [Help text drifts from README] → README links to `--help` and keeps only a short table. Help is generated from the same tables the parser uses.

## Migration Plan

- The changeset is a patch for `mcp-apps-studio`.
- The e2e suite and `scripts/pack-smoke.mjs` already invoke only valid argument shapes (`--port`, a 32-char `--token`, `test --out`), so they need no change.
