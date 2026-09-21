import { McpAppsAdapter, type HostAdapter } from '@studio/host-emulator';

/**
 * The one adapter the studio speaks. Everything protocol-specific (iframe env,
 * display modes, wire translation) is asked from here, so a future
 * `openai-apps` adapter is a one-line swap.
 */
export const adapter: HostAdapter = new McpAppsAdapter();
