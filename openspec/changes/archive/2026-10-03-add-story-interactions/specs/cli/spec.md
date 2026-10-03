# Spec Delta

## ADDED Requirements

### Requirement: Scenario steps in test runs
When a scenario has `steps`, every `test` run of that scenario SHALL play them in order once the handshake check and settle delay are done, before the run is evaluated and before the screenshot is taken.
- Action steps (`click`, `fill`, `press`) SHALL act on elements inside the widget's iframe. An action that fails within its `timeoutMs` (default 5000) fails the step.
- `expectToolCall` SHALL be satisfied by a widget→host `tools/call` request whose `name` equals the expected name and whose `arguments` contain the expected `arguments` as a deep subset. Objects match key by key, arrays match element by element at equal length, and primitives match by strict equality.
- `expectMessage` SHALL be satisfied by a widget→host request or notification with the expected `method` whose `params` contain the expected `params` as a deep subset.
- Each expectation SHALL consume the earliest matching message in the trace not consumed by an earlier expectation in the same run, including messages sent before the steps started. It SHALL wait up to its `timeoutMs` (default 5000) for one to arrive. Consumed messages SHALL be identified by the trace entry's stable sequence number, so the studio dropping old entries from its capped trace never lets one message satisfy two expectations.
- The first failing step SHALL fail the run with a reason of the form `step <n> (<summary>): <cause>`, and the steps after it SHALL NOT run. For an unmet expectation, the cause SHALL list the messages with that method that were seen, or say that none were seen.
- The run SHALL still be evaluated on the full trace and its screenshot still taken. A run with a failed step MUST NOT update a visual baseline.

#### Scenario: Refresh calls the tool
- **WHEN** a widget calls `get_metrics` on mount and once per Refresh click, and its scenario has `steps: [{ expectToolCall: { name: 'get_metrics' } }, { click: 'button.refresh' }, { expectToolCall: { name: 'get_metrics' } }]`
- **THEN** the run passes

#### Scenario: Broken button
- **WHEN** the same steps run but clicking Refresh sends nothing
- **THEN** the run fails with a reason starting `step 3 (expectToolCall get_metrics)`, because the mount call was consumed by step 1

#### Scenario: Argument subset
- **WHEN** the widget calls `get_rows` with `{ page: 2, size: 20 }` and the step expects `{ name: 'get_rows', arguments: { page: 2 } }`
- **THEN** the expectation is met

#### Scenario: Wrong arguments
- **WHEN** the widget calls `get_rows` with `{ page: 1 }` and the step expects `arguments: { page: 2 }`
- **THEN** the run fails with a reason that starts `step 1 (expectToolCall get_rows)` and quotes the seen arguments `{"page":1}`

#### Scenario: One call satisfies one expectation
- **WHEN** the widget calls `get_metrics` once on load and the steps contain two `expectToolCall get_metrics` with no action between them
- **THEN** the first is met and the second fails after its timeout

#### Scenario: Capped trace
- **WHEN** an expectation consumed a call and the studio then drops older trace entries, shifting that call's position
- **THEN** a second identical expectation does not match that call again

#### Scenario: Missing element stops the steps
- **WHEN** the first step clicks `#nope`, which does not exist, and a second step expects a tool call
- **THEN** the run fails with one step failure naming `step 1 (click #nope)`, the second step is not played, and a screenshot is still saved

#### Scenario: Failed step keeps the baseline
- **WHEN** `--update-snapshots` runs a scenario whose expectation is unmet
- **THEN** no baseline is written for that run
