# Tasks

## 1. Pure parsing

- [x] 1.1 `args.ts`: `parseCli(argv)` with per-command `parseArgs` option tables, help/version, validation of port (1–65535), token (≥32 `[A-Za-z0-9_-]`), threshold, max-diff-pixels, themes, flag values that start with `-`; help text generated from the tables, `--token` hidden — verify `args.test.ts` (table of valid/invalid argv → expected result)

## 2. I/O edges

- [x] 2.1 `assets.ts`: injectable workspace resolver, `source: 'bundled' | 'workspace' | 'missing'` instead of throwing — verify new `assets.test.ts` case (resolver throws → `missing`)
- [ ] 2.2 `server.ts`: `listenLoopback(server, port)` → bound port, `PortInUseError` on `EADDRINUSE` — verify new `server.test.ts` case with an occupied port
- [ ] 2.3 `resolveProjectDir(arg, cwd)`: existing dir → absolute path; missing bare word → "neither a command nor a directory"; missing path → "directory not found" — verify unit test with temp dirs

## 3. Dispatcher

- [ ] 3.1 `bin.ts` rewritten as `main()` dispatching `parseCli` results to the existing command implementations; `main().catch` prints one-line errors (stack with `MCP_APPS_STUDIO_DEBUG=1`); asset and port messages — verify `bin.test.ts` spawn cases (`--help`, `test --help`, `--version`, unknown flag, missing value, `tset`, `--port 70000`, weak token, busy port) and `pnpm e2e` green

## 4. Wrap-up

- [ ] 4.1 README CLI section (command table + `--help`), CLAUDE.md (`args.ts`, `listenLoopback`, error policy), changeset (patch) — verify by reading the diff
- [ ] 4.2 `pnpm openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`, `pnpm smoke:pack` all green
