import { z } from 'zod';
import { mockConfigSchema } from '@studio/shared';

/** Shape of a `*.stories.mcp.ts` default export; validated at discovery time. */
export const widgetStoryConfigSchema = z.object({
  title: z.string().min(1),
  /** Path to the widget HTML, relative to the story file. */
  widget: z.string().min(1),
  scenarios: z.record(z.string(), z.object({ mocks: mockConfigSchema.optional() })),
});
export type WidgetStoryConfig = z.infer<typeof widgetStoryConfigSchema>;

/** Identity helper: gives story files type checking without a runtime dependency. */
export function defineWidgetStory(config: WidgetStoryConfig): WidgetStoryConfig {
  return config;
}
