import type { MockConfig } from './mocks.js';

export type WidgetSource =
  | { kind: 'resource'; uri: string; html: string }
  | { kind: 'dev'; url: string };

export interface WidgetStoryScenario {
  mocks: MockConfig;
}

export interface WidgetManifestEntry {
  id: string;
  title: string;
  html: string;
  scenarios: Record<string, WidgetStoryScenario>;
}
