import { z } from 'zod';

export const MCP_APPS_PROTOCOL_VERSION = '2026-01-26';

/** Mime type marking an MCP Apps ui:// HTML resource. */
export const MCP_APPS_RESOURCE_MIME = 'text/html;profile=mcp-app';

/**
 * Wire method names for the MCP Apps extension (SEP-1865), spec 2026-01-26.
 * Single source of truth — adjust here when the spec evolves.
 */
export const MCP_APPS_METHODS = {
  // View → Host
  uiInitialize: 'ui/initialize',
  toolsCall: 'tools/call',
  resourcesRead: 'resources/read',
  sizeChanged: 'ui/notifications/size-changed',
  // Host → View
  hostContextChanged: 'ui/notifications/host-context-changed',
  toolInput: 'ui/notifications/tool-input',
} as const;

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
