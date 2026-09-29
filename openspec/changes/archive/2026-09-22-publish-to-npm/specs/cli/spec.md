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
`init [widget.html…] [--tool <name>]` SHALL write `<name>.stories.mcp.ts` for each given widget (default: every `*.html` under the current directory containing `ui/initialize` or `@modelcontextprotocol/ext-apps`, skipping `node_modules` and dot-directories) with scenarios `default`, `loading`, `error` and `live` whose `toolCall.name` is `--tool` (default `my_tool`). The story SHALL be placed next to the widget, or under `<root>/stories/` when the widget sits inside a `dist` or `build` directory (build output is wiped on rebuild). It MUST NOT overwrite an existing story.

#### Scenario: Scaffold a story
- **WHEN** `init widgets/weather.html` runs in a project without a story
- **THEN** `widgets/weather.stories.mcp.ts` exists, discovery loads it, and it has the four scenarios

#### Scenario: Built widget
- **WHEN** `init dist/bundle.html` runs
- **THEN** `stories/bundle.stories.mcp.ts` is written with `widget: '../dist/bundle.html'`

#### Scenario: Story already exists
- **WHEN** `init` targets a widget whose story file exists
- **THEN** the file is left untouched and the command reports it as skipped
