import { describe, expect, it } from 'vitest';
import {
  callToolResultSchema,
  loggingMessageParamsSchema,
  MCP_APPS_METHODS,
  messageParamsSchema,
  openLinkParamsSchema,
  requestDisplayModeParamsSchema,
  updateModelContextParamsSchema,
} from './protocol.js';

describe('MCP_APPS_METHODS', () => {
  it('covers the View ↔ Host methods of ext-apps 2026-01-26', () => {
    expect(MCP_APPS_METHODS).toMatchObject({
      initialized: 'ui/notifications/initialized',
      openLink: 'ui/open-link',
      message: 'ui/message',
      requestDisplayMode: 'ui/request-display-mode',
      updateModelContext: 'ui/update-model-context',
      downloadFile: 'ui/download-file',
      requestTeardown: 'ui/notifications/request-teardown',
      loggingMessage: 'notifications/message',
      toolInput: 'ui/notifications/tool-input',
      toolInputPartial: 'ui/notifications/tool-input-partial',
      toolResult: 'ui/notifications/tool-result',
      toolCancelled: 'ui/notifications/tool-cancelled',
      resourceTeardown: 'ui/resource-teardown',
    });
  });
});

describe('param schemas', () => {
  it('ui/open-link requires a URL, naming the field', () => {
    expect(openLinkParamsSchema.safeParse({ url: 'https://example.com' }).success).toBe(true);
    const r = openLinkParamsSchema.safeParse({ url: 'not a url' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['url']);
  });

  it('ui/open-link accepts web and mail links only', () => {
    expect(openLinkParamsSchema.safeParse({ url: 'http://example.com/a' }).success).toBe(true);
    expect(openLinkParamsSchema.safeParse({ url: 'mailto:a@example.com' }).success).toBe(true);
    expect(openLinkParamsSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
    expect(openLinkParamsSchema.safeParse({ url: 'data:text/html,<b>x</b>' }).success).toBe(false);
    expect(openLinkParamsSchema.safeParse({ url: 'file:///etc/passwd' }).success).toBe(false);
  });

  it('ui/message takes a user role and content blocks', () => {
    expect(messageParamsSchema.safeParse({ role: 'user', content: [{ type: 'text', text: 'hi' }] }).success).toBe(true);
    expect(messageParamsSchema.safeParse({ role: 'assistant', content: [] }).success).toBe(false);
    expect(messageParamsSchema.safeParse({ role: 'user', content: [{ text: 'no type' }] }).success).toBe(false);
  });

  it('ui/request-display-mode accepts only known modes', () => {
    expect(requestDisplayModeParamsSchema.safeParse({ mode: 'fullscreen' }).success).toBe(true);
    expect(requestDisplayModeParamsSchema.safeParse({ mode: 'sidebar' }).success).toBe(false);
  });

  it('ui/update-model-context fields are optional', () => {
    expect(updateModelContextParamsSchema.safeParse({}).success).toBe(true);
    expect(updateModelContextParamsSchema.safeParse({ structuredContent: { a: 1 } }).success).toBe(true);
    expect(updateModelContextParamsSchema.safeParse({ structuredContent: [1] }).success).toBe(false);
  });

  it('notifications/message requires level and data', () => {
    expect(loggingMessageParamsSchema.safeParse({ level: 'info', data: 'x' }).success).toBe(true);
    expect(loggingMessageParamsSchema.safeParse({ data: 'x' }).success).toBe(false);
  });
});

describe('callToolResultSchema', () => {
  it('keeps a result with structured content unchanged', () => {
    const result = { content: [{ type: 'text', text: 'ok' }], structuredContent: { v: 1 } };
    expect(callToolResultSchema.parse(result)).toEqual(result);
  });

  it('never promotes a bare payload to structured content', () => {
    expect(callToolResultSchema.parse({ value: 1 })).toEqual({ content: [] });
  });

  it('keeps isError and passes unknown block fields through', () => {
    const r = callToolResultSchema.parse({ isError: true, content: [{ type: 'text', text: 'x', annotations: {} }] });
    expect(r).toEqual({ isError: true, content: [{ type: 'text', text: 'x', annotations: {} }] });
  });
});
