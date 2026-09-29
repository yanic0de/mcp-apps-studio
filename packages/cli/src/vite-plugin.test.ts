import { describe, expect, it } from 'vitest';
import { mcpAppsStudio } from './vite-plugin.js';

const origins = (cors: unknown) =>
  (mcpAppsStudio().config({ server: { cors } }).server.cors as { origin: unknown[] }).origin;

describe('mcpAppsStudio vite plugin', () => {
  it('adds the null origin next to configured origins', () => {
    expect(origins({ origin: ['http://a.test'] })).toEqual(['http://a.test', 'null']);
    expect(origins({ origin: 'http://a.test' })).toEqual(['http://a.test', 'null']);
  });

  it("keeps Vite's localhost default when cors is not configured", () => {
    const list = origins(undefined);
    expect(list).toContain('null');
    const localhost = list.find((o) => o instanceof RegExp) as RegExp;
    expect(localhost.test('http://localhost:5173')).toBe(true);
    expect(localhost.test('http://evil.test')).toBe(false);
  });

  it('leaves cors: true (allow all) untouched', () => {
    expect(mcpAppsStudio().config({ server: { cors: true } }).server.cors).toBe(true);
  });

  it('is named for Vite', () => {
    expect(mcpAppsStudio().name).toBe('mcp-apps-studio');
  });
});
