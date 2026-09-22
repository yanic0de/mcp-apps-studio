import { describe, expect, it } from 'vitest';
import { defaultHostContext, hostContextSchema } from './host-context.js';
import { MCP_APPS_METHODS, MCP_APPS_PROTOCOL_VERSION, toolsCallParamsSchema } from './protocol.js';

describe('hostContextSchema', () => {
  it('accepts the default context', () => {
    expect(hostContextSchema.safeParse(defaultHostContext).success).toBe(true);
  });

  it('accepts full spec-shaped context', () => {
    const full = {
      theme: 'dark',
      locale: 'en-US',
      displayMode: 'inline',
      containerDimensions: { width: 400, maxHeight: 600 },
      styles: { variables: { '--color-background-primary': '#fff' }, css: { fonts: '@font-face {}' } },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    expect(hostContextSchema.safeParse(full).success).toBe(true);
  });

  it('accepts the SDK environment fields', () => {
    const ctx = {
      ...defaultHostContext,
      availableDisplayModes: ['inline', 'fullscreen'],
      timeZone: 'Europe/Berlin',
      platform: 'mobile',
      userAgent: 'claude-ios',
      deviceCapabilities: { touch: true, hover: false },
      containerDimensions: { height: 300, maxWidth: 800 },
    };
    expect(hostContextSchema.safeParse(ctx).success).toBe(true);
  });

  it('defaults to a web platform with the studio user agent', () => {
    expect(defaultHostContext).toMatchObject({ platform: 'web', userAgent: 'mcp-apps-studio' });
  });

  it('rejects unknown theme', () => {
    expect(hostContextSchema.safeParse({ ...defaultHostContext, theme: 'sepia' }).success).toBe(false);
  });
});

describe('protocol constants', () => {
  it('pins spec version and method names', () => {
    expect(MCP_APPS_PROTOCOL_VERSION).toBe('2026-01-26');
    expect(MCP_APPS_METHODS.hostContextChanged).toBe('ui/notifications/host-context-changed');
  });

  it('validates tools/call params', () => {
    expect(toolsCallParamsSchema.safeParse({ name: 'get_metrics', arguments: { q: 1 } }).success).toBe(true);
    expect(toolsCallParamsSchema.safeParse({ arguments: {} }).success).toBe(false);
  });
});
