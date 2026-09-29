/**
 * Vite plugin: lets the dev server serve widgets into MCP Apps Studio's sandboxed iframe.
 * Real hosts sandbox widgets without `allow-same-origin`, so the frame's origin is `null`, and
 * Vite (6+) refuses module scripts and the HMR client to that origin. This adds `null` to
 * `server.cors.origin`. Dev-only trade-off: any null-origin page can then read the dev server.
 *
 *   import { mcpAppsStudio } from 'mcp-apps-studio/vite';
 *   export default defineConfig({ plugins: [mcpAppsStudio()] });
 *
 * Structurally typed so this package does not depend on vite.
 */

/** Vite's default allowed origins (localhost, 127.0.0.1, [::1]). */
const VITE_DEFAULT_ORIGIN = /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

type Origin = string | RegExp;
interface ServerConfigLike {
  server?: { cors?: unknown };
}

export function mcpAppsStudio() {
  return {
    name: 'mcp-apps-studio',
    config(config: ServerConfigLike): { server: { cors: unknown } } {
      const cors = config.server?.cors;
      if (cors === true) return { server: { cors } }; // already allows every origin
      const current =
        cors && typeof cors === 'object' && 'origin' in cors
          ? (cors as { origin: unknown }).origin
          : VITE_DEFAULT_ORIGIN;
      const list: Origin[] = (Array.isArray(current) ? current : [current]).filter(
        (o): o is Origin => typeof o === 'string' || o instanceof RegExp,
      );
      if (!list.includes('null')) list.push('null');
      return { server: { cors: { ...(typeof cors === 'object' ? cors : {}), origin: list } } };
    },
  };
}
