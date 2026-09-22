# Component Library

## Purpose

`@studio/components` is a source-distributed widget library (shadcn model): a component is copied into the user's project by `mcp-apps-studio add` rather than depended on. Every component follows one contract: theming through host CSS variables, a text fallback, a story file with scenarios, host communication only through `@studio/widget-runtime`.

## Requirements

### Requirement: Component contract
Every component SHALL: theme itself only through `--widget-*` variables with fallback values and the `[data-theme='dark']` selector; export a text fallback function; ship a `*.stories.mcp.ts` with `default`, `loading` or `empty`, and `error` scenarios; and MUST NOT touch `window.parent` directly.

#### Scenario: Dark theme
- **WHEN** the host sends `theme: 'dark'` and the runtime sets `data-theme="dark"`
- **THEN** the component switches background and text color without a reload

#### Scenario: Host without UI support
- **WHEN** the server answers with text only
- **THEN** the component's fallback function yields an equivalent text representation

### Requirement: Self-contained build
`build.mjs` SHALL bundle each component into a single `dist/<name>.html` (vite + singlefile, target es2022; entries use top-level await). Story files point at `dist`, so the build SHALL precede showing the library in the studio.

#### Scenario: Library build
- **WHEN** `pnpm -F @studio/components build` runs
- **THEN** `dist/kpi-card.html` and `dist/data-table.html` appear
- **AND** each file renders in a sandboxed iframe with no external requests

### Requirement: Widget entry point
A component's entry SHALL call `connectWidget({ appInfo })` from `@studio/widget-runtime` (theme, variables and fonts are applied and size is reported by the SDK's auto-resize), then mount the component inside `WidgetProvider` with the returned session.

#### Scenario: Loading in the studio
- **WHEN** the iframe with the bundled component loads
- **THEN** `ui/initialize`, `ui/notifications/initialized`, `tools/call` and `size-changed` from the widget appear in the trace

### Requirement: KPI Card
`KpiCard` SHALL call a tool on mount (default `get_metrics`), show `structuredContent.value` via `toLocaleString`, a caption with `label` and the direction of `delta`, a `loading…` state, the error text, and a `Refresh` button with `type="button"`.

#### Scenario: Data received
- **WHEN** the tool returns `structuredContent: { value: 12840, delta: 8.3, label: 'Monthly active users' }`
- **THEN** the value renders as `12,840` and the status contains `Monthly active users ▲8.3%`

#### Scenario: Tool error
- **WHEN** the tool returns `isError: true` with the text `Metrics backend unavailable`
- **THEN** the status contains that message and the error class

### Requirement: Data Table
`DataTable` SHALL call a tool (default `get_rows`), expect `{ columns: [{ key, label }], rows }`, render a table with headers from `columns`, a `loading…` state, the `No rows.` message for an empty list, and the error text. The fallback `dataTableTextFallback(data, maxRows)` SHALL print the header and the first `maxRows` rows with a note about the hidden ones.

#### Scenario: Empty result
- **WHEN** the tool returns `rows: []`
- **THEN** `No rows.` is shown

#### Scenario: Truncated text fallback
- **WHEN** there are three rows and `maxRows = 2`
- **THEN** the text contains two rows and the note `1 more row`

### Requirement: Registry
`registry.json` SHALL list components with `name`, `title`, `description`, `files` (source paths) and `dependencies` (`@studio/widget-runtime`). The `add` command SHALL copy exactly the listed files.

#### Scenario: Adding kpi-card
- **WHEN** `mcp-apps-studio add kpi-card` runs
- **THEN** `KpiCard.tsx`, `kpi-card.css`, `fallback.ts` are copied into the target directory
