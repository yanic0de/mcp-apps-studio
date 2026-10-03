import type { WidgetManifestEntry } from '@studio/shared';
import { describe, expect, it } from 'vitest';
import { demoWidget } from './demo.js';
import { loadManifest, widgetsForManifest } from './manifest.js';

const kpi: WidgetManifestEntry = { id: 'kpi', title: 'KPI', html: '', scenarios: { default: { mocks: {} } } };

const response = (body: unknown, contentType = 'application/json') =>
  Promise.resolve(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { headers: { 'content-type': contentType } }),
  );

describe('widgetsForManifest', () => {
  it('keeps the served widgets', () => {
    expect(widgetsForManifest({ widgets: [kpi], errors: [] })).toEqual([kpi]);
  });

  it('shows the demo when no story is left (fresh start or every story deleted)', () => {
    expect(widgetsForManifest({ widgets: [], errors: [] })).toEqual([demoWidget]);
    expect(widgetsForManifest({ widgets: [], errors: [{ file: 'a', message: 'x' }] })).toEqual([demoWidget]);
  });
});

describe('loadManifest', () => {
  it('returns an empty manifest instead of failing, so a reload can clear deleted stories', async () => {
    await expect(loadManifest(() => response({ widgets: [], errors: [] }))).resolves.toEqual({
      widgets: [],
      errors: [],
    });
  });

  it('fails when the response is not a manifest (plain vite dev serves the SPA)', async () => {
    await expect(loadManifest(() => response('<!doctype html>', 'text/html'))).rejects.toThrow();
  });
});
