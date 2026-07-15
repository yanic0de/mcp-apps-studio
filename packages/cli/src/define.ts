import type { MockConfig } from '@studio/shared';

export interface WidgetStoryConfig {
  title: string;
  /** Path to the widget HTML, relative to the story file. */
  widget: string;
  scenarios: Record<string, { mocks?: MockConfig }>;
}

/** Identity helper: gives story files type checking without a runtime dependency. */
export function defineWidgetStory(config: WidgetStoryConfig): WidgetStoryConfig {
  return config;
}
