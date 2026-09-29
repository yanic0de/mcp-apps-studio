## MODIFIED Requirements

### Requirement: Registry
`registry.json` SHALL list components with `name`, `title`, `description`, `files` (source paths) and `dependencies` (`@mcp-apps-studio/widget-runtime`). The `add` command SHALL copy exactly the listed files, from the registry bundled with the CLI when installed.

#### Scenario: Adding kpi-card
- **WHEN** `mcp-apps-studio add kpi-card` runs
- **THEN** `KpiCard.tsx`, `kpi-card.css`, `fallback.ts` are copied into the target directory
