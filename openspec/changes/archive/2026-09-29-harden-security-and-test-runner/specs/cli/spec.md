# Spec Delta: cli

## MODIFIED Requirements

### Requirement: add subcommand
`add <name> [--dir <dir>] [--force]` SHALL copy the component's files from `registry.json` into `<dir>/<name>/` (default `src/components`) and remind about the `@mcp-apps-studio/widget-runtime` dependency. A file that already exists in the destination MUST NOT be overwritten unless `--force` is given; skipped files SHALL be listed as skipped. An unknown or missing name SHALL print an error listing the available components, without a stack trace, and exit `1`.

#### Scenario: Unknown component
- **WHEN** `add nope` runs
- **THEN** the error lists `kpi-card` and `data-table`, no stack trace is printed and the exit code is `1`

#### Scenario: Re-adding keeps local edits
- **WHEN** `add kpi-card` runs a second time after the user edited `KpiCard.tsx`
- **THEN** `KpiCard.tsx` keeps the user's content and is reported as skipped

#### Scenario: Forced re-add
- **WHEN** `add kpi-card --force` runs after the user edited `KpiCard.tsx`
- **THEN** `KpiCard.tsx` is replaced with the registry version

### Requirement: Test plan and run evaluation
The plan SHALL contain one run per widget × non-`live` scenario × theme, in manifest order. A run SHALL pass only if the studio rendered the run's widget, scenario and theme, the trace contains the widget's `ui/initialize` request, the host's response to it, and the `ui/notifications/initialized` notification, and contains no `invalid` events; each unmet condition SHALL be listed as a failure reason. A run that throws (navigation failure, crashed page, unreadable baseline) SHALL be recorded as a failed run whose reason is the error message, the remaining runs SHALL still execute, and the reports SHALL still be written.

#### Scenario: Plan skips live
- **WHEN** a widget has scenarios `default`, `error`, `live` and themes are `light,dark`
- **THEN** the plan has four runs: `default` and `error` for each theme

#### Scenario: Invalid message fails the run
- **WHEN** the trace of a run contains an `invalid` event `Unsupported notification: wat`
- **THEN** the run fails with a reason quoting that error

#### Scenario: Handshake never completed
- **WHEN** the trace has `ui/initialize` but no `ui/notifications/initialized`
- **THEN** the run fails with a reason naming `ui/notifications/initialized`

#### Scenario: Studio rendered another target
- **WHEN** a run requests widget `kpi`, scenario `error` but the studio reports widget `kpi`, scenario `default`
- **THEN** the run fails with a reason naming the requested and the rendered target

#### Scenario: One run crashes
- **WHEN** navigation of the second of three runs throws `net::ERR_ABORTED`
- **THEN** the second run fails with a reason containing `net::ERR_ABORTED`, the first and third runs are evaluated normally, and `report.json` lists all three

### Requirement: Visual snapshots
`test` SHALL accept `--update-snapshots`, `--snapshots <dir>` (default `mcp-studio-snapshots` under the tested directory), `--threshold <0..1>` (default `0.1`) and `--max-diff-pixels <n>` (default `0`). With `--update-snapshots` the screenshot of every passing run SHALL be written as its baseline `<dir>/<widget>/<scenario>.<theme>.png` and the run SHALL not be visually compared; a failing run MUST NOT write or replace its baseline. Otherwise, when the snapshot directory exists, each run SHALL be compared with its baseline: more differing pixels than `--max-diff-pixels`, a different image size or a missing baseline SHALL fail the run with a reason, and a differing run SHALL write `<name>.diff.png` next to its screenshot. When the directory does not exist, no visual comparison SHALL happen.

#### Scenario: Unchanged widget
- **WHEN** baselines were written with `--update-snapshots` and `test` runs again unchanged
- **THEN** every run passes

#### Scenario: Visual change
- **WHEN** a widget's colors change after the baselines were written
- **THEN** the affected runs fail with a reason stating the number of differing pixels and a `.diff.png` exists

#### Scenario: New story without baseline
- **WHEN** the snapshot directory exists but has no baseline for a run
- **THEN** that run fails with a reason suggesting `--update-snapshots`

#### Scenario: Broken run is not blessed
- **WHEN** `test --update-snapshots` runs and a run's handshake never completes
- **THEN** that run fails and its baseline file is neither created nor replaced
