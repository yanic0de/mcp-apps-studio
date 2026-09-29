# Design

## Context

Four of the fixes cut across modules:

- **Test runner.** `runStoryTests` (`packages/cli/src/test-runner.ts`) is one loop that mixes browser driving, the snapshot policy and reporting inside a single `try/finally`. Any throw escapes the loop, so reporting never runs. The file has no unit test because it imports `playwright-core` directly.
- **Deep links.** The studio resolves them leniently for humans: an unknown `?widget=` falls back to the first widget. The runner cannot tell that this happened, because the automation hook only exposes the log.
- **Host context.** `HostEmulator.setHostContext` is called both by the embedder (Canvas effects on theme, device or resize) and internally (an accepted `ui/request-display-mode`). It notifies unconditionally.
- **Action.** `action.yml` interpolates inputs into `run:`.

## Goals / Non-Goals

**Goals:**
- `test` produces a report for every run, whatever happens.
- The runner has unit tests without a real browser.
- Each security fix is locked in by a test: action/workflow lint, schema, bind address.

**Non-Goals:**
- Making deep links strict for humans. The studio stays lenient; only the runner checks.
- Routing dev widgets through a proxy instead of the Vite `null`-origin CORS entry. That needs its own change.
- CSP for widgets, security headers on the CLI server, token stripping from the URL. These are follow-ups.
- The `release.yml` gate and npm OIDC. They belong to the release/OSS-readiness change.
- `qs` (a transitive dependency via express). It is dev-only and waits for upstream.

## Decisions

- **Per-run executor with a duck-typed page.**
  - Extract `executeRun(page, run, ctx)` into `packages/cli/src/run-executor.ts`. It takes a minimal `RunPage` interface: `goto`, `waitForFunction`, `waitForTimeout`, `evaluate`, `screenshotViewport`, `close`. It returns a `RunResult` and never throws: every step sits in a `try/catch` that turns an exception into `ok: false` with the error message, and `finally` closes the page.
  - `runStoryTests` keeps discovery, serving and launching, then adapts the Playwright `Page` to `RunPage` in a few lines.
  - This is the same pattern as `IframeTransport`'s `ListeningWindow`: tests run in node with fakes. An alternative was to mock `playwright-core` through vitest module mocking. It was rejected because it is brittle and couples tests to the import shape.
- **Snapshot policy as a pure step.** After evaluation, `--update-snapshots` copies the screenshot only when `result.ok`. Otherwise it appends `baseline not updated: run failed`, so the reason is visible. Comparison runs only when there was a screenshot and no update.
- **Rendered-target check.**
  - The hook gains `getActive()`, built from the store: `activeWidgetId`, `scenario`, `hostContext.theme`. It moves into `apps/studio/src/automation.ts` (`createAutomationHook(getState)`) so it can be tested next to the store, and `App.tsx` only installs it.
  - The evaluation helper `checkTarget(run, active)` in `test-plan.ts` returns failure reasons. It is pure and unit-tested.
  - The runner calls `getActive()` after the handshake wait.
- **Host context gating.**
  - The emulator keeps `sentContext`: the context it put into the last `ui/initialize` result.
  - `setHostContext` always merges. It notifies only when `ready && running`.
  - On `initialized` (first time for this view), it diffs the current context against `sentContext` by top-level key, using JSON comparison for nested objects such as `containerDimensions`. When anything changed, it sends one `host-context-changed` with those keys before playing the tool call.
  - A widget-requested display mode works unchanged. The widget can only request after the handshake, and the request's response carries the mode anyway.
  - An alternative was to queue every patch until ready. It was rejected: it would replay stale intermediate values, and a diff is what a host that "sends changes since what you know" does.
- **`ui/open-link` scheme allow-list** via zod 4 `z.url({ protocol: /^(https?|mailto)$/ })`.
  - `mailto:` is kept because real widgets use it and a false rejection would make the studio stricter than the hosts it emulates. `javascript:` and `data:` are rejected because no host opens them.
  - The ext-apps `spec.types.d.ts` types it as a plain string, so the conformance test must keep passing with an https link.
- **`add` without clobbering.** Check with `fs.copyFile(src, dest, fs.constants.COPYFILE_EXCL)` and catch `EEXIST` to mark the file skipped. This is atomic and avoids a stat/copy race. With `--force` it uses a plain copy. `addComponent` returns `{ copied, skipped }`. `bin.ts` catches the unknown-name error, prints the message and exits `1`.
- **Action inputs through env.**
  - Each shell step gets `env: { STUDIO_VERSION: ${{ inputs.version }}, STUDIO_ARGS: ${{ inputs.args }} }`.
  - A first step validates `STUDIO_VERSION` against `^[A-Za-z0-9.^~-]+$` and exits `1` otherwise.
  - `STUDIO_ARGS` is expanded unquoted under `set -f` (no globbing). Word splitting is what users expect from "extra flags", and an expanded variable's content is never parsed for `;`, `|` or `$(...)`, so this is not injectable.
  - `directory` stays in `working-directory:`, which is not evaluated by a shell.
- **SHA pins and permissions.**
  - Pin every action to the SHA its current tag points to, resolved with `gh api` at implementation time, with a `# vX.Y.Z` comment.
  - Add `helpers:pinGitHubActionDigests` to renovate so the pins get bumped.
  - `ci.yml` gets top-level `permissions: contents: read`; `release.yml` already declares its own.
- **Workflow lint as a unit test.**
  - `packages/cli/src/workflows.test.ts` parses `action.yml` and `.github/workflows/*.yml` with `yaml` (new devDependency) and asserts: SHA-pinned `uses:`, top-level `permissions` in workflows, and no `${{` in any `run:`.
  - It also runs the action's validation script with `bash`, passing a hostile `STUDIO_VERSION`. That part is skipped on Windows unless bash is on PATH.
  - It lives in `packages/cli` because the root vitest include only covers `packages/*/src` and `apps/*/src`, and the Action belongs to the CLI's distribution.
- **Server bind.**
  - Use `app.listen(PORT, HOST)` with `HOST = process.env.HOST ?? '127.0.0.1'`. The listen callback prints the address from `server.address()`.
  - A test in each server package spawns `tsx src/main.ts` with `PORT=0`, reads the printed URL, asserts host `127.0.0.1`, fetches `/health`, and kills the process.
  - The e2e config already probes `127.0.0.1`. The studio default `http://localhost:3100/mcp` still works because browsers and undici fall back from `::1` to IPv4.

## Risks / Trade-offs

- [The context diff on `initialized` could send a change that equals what the widget got] → the diff compares values, not patch history, so only real differences are sent. A unit test covers the "no change → no notification" case.
- [SHA pins go stale] → renovate's digest helper opens bump PRs.
- [`z.url({ protocol })` behaves differently across zod 4 minors] → the workspace resolves zod 4.4.3. Schema tests pin the behavior, and the `^4.0.0` range in shared is raised to `^4.4.3` so a consumer cannot resolve an older minor.
- [Spawning tsx in unit tests is slow or flaky on Windows CI] → one spawn per server with a 10 s timeout. It uses `PORT=0`, so there are no port clashes.
- [`getActive()` is a new public-ish surface] → it is read-only and documented as automation-only, like `getLog()`.

## Migration Plan

- No user migration is needed.
- Action users who passed a `version` with spaces or shell syntax (not valid anyway) get an early error.
- The changeset is a patch for `mcp-apps-studio`.
- Rollback is a revert.
