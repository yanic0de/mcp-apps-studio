## ADDED Requirements

### Requirement: test subcommand
`mcp-apps-studio test [dir] [--out <dir>] [--themes <list>]` SHALL discover the stories under `dir`, serve the studio on an ephemeral `127.0.0.1` port with a random token, and in headless Chromium open every widget × scenario × theme (default themes `light,dark`), skipping scenarios named `live`. For each run it SHALL record pass/fail with reasons and save a PNG of the widget viewport under `<out>/<widget>/<scenario>.<theme>.png`, then write `<out>/report.json` (default `out` = `.mcp-studio/test`) and print one line per run. The exit code SHALL be `0` when every run passed, `1` when any failed, `2` when no browser is available (with the install hint).

#### Scenario: Component library passes
- **WHEN** `mcp-apps-studio test ../components` runs after building the library
- **THEN** the exit code is `0`, `report.json` lists every scenario for both themes, and a PNG exists per run

### Requirement: Test plan and run evaluation
The plan SHALL contain one run per widget × non-`live` scenario × theme, in manifest order. A run SHALL pass only if the trace contains the widget's `ui/initialize` request, the host's response to it, and the `ui/notifications/initialized` notification, and contains no `invalid` events; each unmet condition SHALL be listed as a failure reason.

#### Scenario: Plan skips live
- **WHEN** a widget has scenarios `default`, `error`, `live` and themes are `light,dark`
- **THEN** the plan has four runs: `default` and `error` for each theme

#### Scenario: Invalid message fails the run
- **WHEN** the trace of a run contains an `invalid` event `Unsupported notification: wat`
- **THEN** the run fails with a reason quoting that error

#### Scenario: Handshake never completed
- **WHEN** the trace has `ui/initialize` but no `ui/notifications/initialized`
- **THEN** the run fails with a reason naming `ui/notifications/initialized`
