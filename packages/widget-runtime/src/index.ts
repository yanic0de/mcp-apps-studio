// The widget side of MCP Apps is the official SDK; this package only adds studio conveniences on top.

export type { CallToolResult } from '@modelcontextprotocol/client';
export {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
export * from './lifecycle-store.js';
export * from './session.js';
export * from './tool-caller.js';
export * from './tool-lifecycle.js';
export * from './tool-result.js';
