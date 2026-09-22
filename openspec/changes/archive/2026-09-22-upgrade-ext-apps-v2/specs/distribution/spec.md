## ADDED Requirements

### Requirement: Current SDK generation
The published packages SHALL target the current major of `@modelcontextprotocol/ext-apps` (2.x) and the MCP SDK v2 packages: `@mcp-apps-studio/widget-runtime` SHALL declare `@modelcontextprotocol/ext-apps` `^2` and `@modelcontextprotocol/client` `^2` as peers, and the repository MUST NOT depend on `@modelcontextprotocol/sdk`.

#### Scenario: Installing with the SDK's own instructions
- **WHEN** a project installs `@modelcontextprotocol/ext-apps @modelcontextprotocol/client zod` (latest) and `@mcp-apps-studio/widget-runtime`
- **THEN** npm reports no unmet peer dependency for widget-runtime
