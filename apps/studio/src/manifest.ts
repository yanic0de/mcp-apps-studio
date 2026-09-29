import type { StudioManifest, WidgetManifestEntry } from '@studio/shared';
import { demoWidget } from './demo.js';

type Fetch = (url: string) => Promise<Response>;

/** The CLI manifest; rejects when there is none (plain `vite dev` serves the SPA instead). An empty one is valid. */
export async function loadManifest(fetchImpl: Fetch = (url) => fetch(url)): Promise<StudioManifest> {
  const res = await fetchImpl('/api/manifest');
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    throw new Error('no manifest');
  }
  const body = (await res.json()) as Partial<StudioManifest>;
  return { widgets: body.widgets ?? [], errors: body.errors ?? [] };
}

/** What the canvas shows: the stories, or the built-in demo when none is left — on start and on reload alike. */
export function widgetsForManifest(manifest: StudioManifest): WidgetManifestEntry[] {
  return manifest.widgets.length > 0 ? manifest.widgets : [demoWidget];
}
