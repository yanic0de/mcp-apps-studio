## MODIFIED Requirements

### Requirement: bin entry point
`bin` SHALL accept the project root directory, `--port` (default 4400), `--token` (automation only; default random), locate the built studio — first in the `studio` directory next to the running CLI module (installed package), then in the workspace `@studio/app` build (development) — and print the URL with the token. With no stories it SHALL say the demo widget will be shown.

#### Scenario: Studio not built
- **WHEN** neither location has `index.html`
- **THEN** the process exits with the hint `pnpm -F @studio/app build`

#### Scenario: Installed package
- **WHEN** the CLI runs from its published `dist`
- **THEN** it serves the studio bundled in `dist/studio` without any workspace package

## ADDED Requirements

### Requirement: init subcommand
`init [widget.html…]` SHALL write `<name>.stories.mcp.ts` next to each given widget (default: every `*.html` under the current directory that mentions `ui/initialize` or `@modelcontextprotocol/ext-apps`, skipping `node_modules`, `dist`, `build` and dot-directories) with scenarios `default`, `loading`, `error` and `live`, and MUST NOT overwrite an existing story.

#### Scenario: Scaffold a story
- **WHEN** `init widgets/weather.html` runs in a project without a story
- **THEN** `widgets/weather.stories.mcp.ts` exists, discovery loads it, and it has the four scenarios

#### Scenario: Story already exists
- **WHEN** `init` targets a widget whose story file exists
- **THEN** the file is left untouched and the command reports it as skipped
