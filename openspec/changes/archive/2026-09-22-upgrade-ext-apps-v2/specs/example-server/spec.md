## MODIFIED Requirements

### Requirement: No workspace dependencies
The package MUST NOT depend on other monorepo packages; only `@modelcontextprotocol/ext-apps` (2.x), the MCP SDK v2 packages `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `@modelcontextprotocol/express` (and `@modelcontextprotocol/client` for tests), `express` and `zod` are allowed.

#### Scenario: Copying into another project
- **WHEN** the package directory is copied outside the monorepo
- **THEN** `pnpm install && pnpm dev` works without editing imports
