import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiAppCapabilities,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { createToolLifecycleStore, type ToolLifecycleStore } from './lifecycle-store.js';

export interface ConnectWidgetOptions {
  appInfo: { name: string; version: string };
  capabilities?: McpUiAppCapabilities;
  /** Defaults to the SDK's postMessage transport to `window.parent`. */
  transport?: Transport;
  /** SDK auto-resize: reports the document size to the host (default true). */
  autoResize?: boolean;
  /** Apply theme, style variables and fonts to `document` (default true; off for Node tests). */
  applyToDocument?: boolean;
}

export interface WidgetSession {
  app: App;
  lifecycle: ToolLifecycleStore;
}

/** Carries a host context (or a patch of it) into the document with the SDK helpers. */
export function applyHostContext(ctx: McpUiHostContext): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

/**
 * The official ext-apps `App`, plus what the studio's components need before it connects:
 * the tool lifecycle is recorded and the document follows the host context from the first message.
 */
export async function connectWidget(opts: ConnectWidgetOptions): Promise<WidgetSession> {
  const app = new App(opts.appInfo, opts.capabilities ?? {}, { autoResize: opts.autoResize ?? true });
  const lifecycle = createToolLifecycleStore(app);
  const applyToDocument = opts.applyToDocument ?? true;
  if (applyToDocument) app.addEventListener('hostcontextchanged', applyHostContext);
  await app.connect(opts.transport);
  const ctx = app.getHostContext();
  if (applyToDocument && ctx) applyHostContext(ctx);
  return { app, lifecycle };
}
