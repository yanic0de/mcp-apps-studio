# Proposal: harden-security-and-test-runner

## Why

A pre-release audit found issues that would bite the first public users. The composite GitHub Action pastes inputs into shell commands. The reference servers listen on every interface. `mcp-apps-studio test` can lose the whole report on one crashing run, bless broken runs as visual baselines, and pass a run that rendered a different widget than requested. The emulator sends `host-context-changed` before the handshake, which no real host does. `add` silently overwrites a user's edited component. These must be fixed before the first npm release, since CI users trust the verdict of `test` and the Action runs in their pipelines.

## What Changes

- **GitHub Action and CI supply chain.** `action.yml` passes `version` and `args` to shell steps through `env:` instead of `${{ }}` interpolation, and rejects a `version` that is not a semver or dist-tag. Every `uses:` in `action.yml` and `.github/workflows/*` is pinned to a commit SHA, with the tag in a comment. `ci.yml` declares `permissions: contents: read`. Renovate keeps the pinned digests current.
- **Reference servers** (example-server, test-server) bind to `127.0.0.1` by default. A `HOST` env var overrides it (e.g. for Docker). `hono` is bumped past the audited advisories.
- **`test` runner resilience.** A run that throws (navigation timeout, crash, unreadable baseline) becomes a failed result with the error as its reason. The remaining runs still execute, the page is always closed, and `report.json`, `report.html` and the step summary are always written.
- **Snapshots.** `--update-snapshots` writes a baseline only for runs that passed their protocol checks. A failed run leaves its old baseline untouched and is reported.
- **Rendered-target check.** The studio's automation hook reports the active widget, scenario and theme. A run whose studio shows anything other than the requested target fails.
- **Host context before the handshake.** `HostEmulator.setHostContext` always updates the stored context but notifies the widget only after `ui/notifications/initialized` and while running. Changes made between the `ui/initialize` response and `initialized` are delivered once the handshake completes.
- **`add`.**
  - Existing files are skipped and reported unless `--force` is given.
  - An unknown or missing component name prints a clean error (no stack trace) and exits `1`.
- **`ui/open-link`.** The `url` must use `http:`, `https:` or `mailto:`. `javascript:`, `data:` and other schemes are rejected as invalid params.

No breaking changes to published APIs. The Action keeps its inputs; only a malformed `version` now fails fast.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `cli`: `add subcommand` (skip existing, `--force`, clean errors), `Test plan and run evaluation` (rendered-target check, per-run failure isolation), `Visual snapshots` (baselines only from passing runs).
- `studio-app`: the automation hook exposes the active target alongside the log.
- `host-emulator`: `Host context` (no notification before the handshake or after stop).
- `protocol`: `Method parameter schemas` (`ui/open-link` URL scheme allow-list).
- `example-server`: `Stateless HTTP with CORS` (loopback bind, `HOST` override).
- `test-server`: `HTTP like example-server` (loopback bind, `HOST` override).
- `distribution`: `GitHub Action` (env-passed inputs, version validation), `Continuous integration` (SHA-pinned actions, read-only default permissions).

## Impact

- **Code:**
  - `packages/cli/src/{test-runner,test-plan,add,bin}.ts`
  - `apps/studio/src/App.tsx`
  - `packages/host-emulator/src/host-emulator.ts`
  - `packages/shared/src/protocol.ts`
  - `packages/{example,test}-server/src/main.ts`
  - `action.yml`, `.github/workflows/*.yml`, `renovate.json`
- **Tests:** a new `test-runner` unit test with a fake page, plus workflow lint tests (`yaml` becomes a devDependency of `packages/cli`).
- **Dependencies:** `hono` bump in both reference servers.
- **Users:** the Action works unchanged for valid inputs. Widgets that open non-http(s)/mailto links now see an `invalid params` error in the studio.
