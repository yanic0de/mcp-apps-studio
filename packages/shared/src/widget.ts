import type { MockConfig, ToolCall } from './mocks.js';

export type WidgetSource = { kind: 'resource'; uri: string; html: string } | { kind: 'dev'; url: string };

export interface WidgetStoryScenario {
  mocks: MockConfig;
  /** The tool call that rendered the widget; absent → no lifecycle notifications. */
  toolCall?: ToolCall;
}

interface WidgetManifestBase {
  id: string;
  title: string;
  scenarios: Record<string, WidgetStoryScenario>;
}

/** A widget is either inline HTML (a file / MCP resource) or a dev-server URL (loaded with `src`, keeps its HMR). */
export type WidgetManifestEntry = WidgetManifestBase & ({ html: string; url?: never } | { url: string; html?: never });

/** A story that failed to load; the other stories still make it into the manifest. */
export interface DiscoveryError {
  file: string;
  message: string;
}

export interface StudioManifest {
  widgets: WidgetManifestEntry[];
  errors: DiscoveryError[];
}
