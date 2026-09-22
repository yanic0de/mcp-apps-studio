// Published API of `mcp-apps-studio`: what story files import. The CLI internals are not part of it.
import type { WidgetStoryConfig } from './define.js';

export { defineWidgetStory, type WidgetStoryConfig } from './define.js';

// Derived from the story schema so the published declarations are self-contained.
export type Scenario = WidgetStoryConfig['scenarios'][string];
export type ToolMock = NonNullable<Scenario['mocks']>[string];
export type ToolCall = NonNullable<Scenario['toolCall']>;
export type ToolCallResult = NonNullable<ToolCall['result']>;
