## ADDED Requirements

### Requirement: Visual snapshots
`test` SHALL accept `--update-snapshots`, `--snapshots <dir>` (default `mcp-studio-snapshots` under the tested directory), `--threshold <0..1>` (default `0.1`) and `--max-diff-pixels <n>` (default `0`). With `--update-snapshots` every run's screenshot SHALL be written as its baseline `<dir>/<widget>/<scenario>.<theme>.png` and the run SHALL not be visually compared. Otherwise, when the snapshot directory exists, each run SHALL be compared with its baseline: more differing pixels than `--max-diff-pixels`, a different image size or a missing baseline SHALL fail the run with a reason, and a differing run SHALL write `<name>.diff.png` next to its screenshot. When the directory does not exist, no visual comparison SHALL happen.

#### Scenario: Unchanged widget
- **WHEN** baselines were written with `--update-snapshots` and `test` runs again unchanged
- **THEN** every run passes

#### Scenario: Visual change
- **WHEN** a widget's colors change after the baselines were written
- **THEN** the affected runs fail with a reason stating the number of differing pixels and a `.diff.png` exists

#### Scenario: New story without baseline
- **WHEN** the snapshot directory exists but has no baseline for a run
- **THEN** that run fails with a reason suggesting `--update-snapshots`

### Requirement: Test report
`test` SHALL write `report.html` next to `report.json`, listing every run with status and failure reasons and, for runs with a visual difference, the baseline, actual and diff images (relative paths). When the `GITHUB_STEP_SUMMARY` environment variable names a file, a Markdown table of the runs SHALL be appended to it.

#### Scenario: Reviewing a failure
- **WHEN** a run fails visually
- **THEN** `report.html` shows its baseline, actual and diff images side by side

#### Scenario: GitHub job summary
- **WHEN** `GITHUB_STEP_SUMMARY` is set
- **THEN** the file gains a table with one row per run and a pass/fail count

### Requirement: install-browser subcommand
`install-browser [--with-deps]` SHALL install the Chromium build that matches the CLI's bundled `playwright-core`, and the "no browser" error of `test` SHALL point to it.

#### Scenario: Fresh machine
- **WHEN** `mcp-apps-studio install-browser` runs
- **THEN** `mcp-apps-studio test` can launch Chromium afterwards
