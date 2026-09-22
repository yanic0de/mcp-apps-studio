import { z } from 'zod';
import { displayModeSchema } from './host-context.js';

export const MCP_APPS_PROTOCOL_VERSION = '2026-01-26';

/** Mime type marking an MCP Apps ui:// HTML resource. */
export const MCP_APPS_RESOURCE_MIME = 'text/html;profile=mcp-app';

/**
 * Wire method names for the MCP Apps extension (SEP-1865), spec 2026-01-26,
 * as defined by the @modelcontextprotocol/ext-apps SDK (checked by the
 * host-emulator conformance test). Single source of truth — adjust here when the spec evolves.
 */
export const MCP_APPS_METHODS = {
  // View → Host requests
  uiInitialize: 'ui/initialize',
  toolsCall: 'tools/call',
  resourcesRead: 'resources/read',
  openLink: 'ui/open-link',
  message: 'ui/message',
  requestDisplayMode: 'ui/request-display-mode',
  updateModelContext: 'ui/update-model-context',
  downloadFile: 'ui/download-file',
  // View → Host notifications
  initialized: 'ui/notifications/initialized',
  sizeChanged: 'ui/notifications/size-changed',
  requestTeardown: 'ui/notifications/request-teardown',
  loggingMessage: 'notifications/message',
  // Host → View
  hostContextChanged: 'ui/notifications/host-context-changed',
  toolInput: 'ui/notifications/tool-input',
  toolInputPartial: 'ui/notifications/tool-input-partial',
  toolResult: 'ui/notifications/tool-result',
  toolCancelled: 'ui/notifications/tool-cancelled',
  resourceTeardown: 'ui/resource-teardown',
} as const;

/** MCP content block: only `type` is checked here; the SDK owns the exact block shapes. */
export const contentBlockSchema = z.looseObject({ type: z.string().min(1) });
export type ContentBlock = z.infer<typeof contentBlockSchema>;

const structuredContentSchema = z.record(z.string(), z.unknown());

/** MCP `CallToolResult` — the shape answered to `tools/call`, in mock and live mode alike. */
export const callToolResultSchema = z.object({
  content: z.array(contentBlockSchema).default([]),
  structuredContent: structuredContentSchema.optional(),
  isError: z.boolean().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});
export type CallToolResult = z.infer<typeof callToolResultSchema>;

export const toolsCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});

export const resourcesReadParamsSchema = z.object({
  uri: z.string().min(1),
});

export const sizeChangedParamsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
});

export const openLinkParamsSchema = z.object({
  url: z.url(),
});

export const messageParamsSchema = z.object({
  role: z.literal('user'),
  content: z.array(contentBlockSchema),
});

export const requestDisplayModeParamsSchema = z.object({
  mode: displayModeSchema,
});

export const updateModelContextParamsSchema = z.object({
  content: z.array(contentBlockSchema).optional(),
  structuredContent: structuredContentSchema.optional(),
});

export const downloadFileParamsSchema = z.object({
  contents: z.array(z.looseObject({})),
});

export const loggingMessageParamsSchema = z.object({
  level: z.string().min(1),
  logger: z.string().optional(),
  data: z.unknown().refine((d) => d !== undefined, 'data is required'),
});
