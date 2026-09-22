import type { MockConfig, ToolCall } from './mocks.js';

export type WidgetSource = { kind: 'resource'; uri: string; html: string } | { kind: 'dev'; url: string };

export interface WidgetStoryScenario {
  mocks: MockConfig;
  /** The tool call that rendered the widget; absent → no lifecycle notifications. */
  toolCall?: ToolCall;
}

export interface WidgetManifestEntry {
  id: string;
  title: string;
  html: string;
  scenarios: Record<string, WidgetStoryScenario>;
}
