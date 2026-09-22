import type { StudioManifest } from '@studio/shared';
import { useEffect } from 'react';
import { Canvas } from './components/Canvas.js';
import { HeaderControls } from './components/HeaderControls.js';
import { TracePanel } from './components/TracePanel.js';
import { applyDeepLink } from './deep-link.js';
import { demoWidget } from './demo.js';
import { type TraceEntry, useStudioStore } from './store.js';

declare global {
  interface Window {
    /** Read-only automation hook (used by `mcp-apps-studio test`). */
    __mcpStudio?: { getLog(): TraceEntry[] };
  }
}

async function loadManifest(): Promise<StudioManifest> {
  const res = await fetch('/api/manifest');
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    throw new Error('no manifest');
  }
  const body = (await res.json()) as Partial<StudioManifest>;
  if (!body.widgets?.length && !body.errors?.length) throw new Error('empty manifest');
  return { widgets: body.widgets ?? [], errors: body.errors ?? [] };
}

/** CLI live reload: the watcher pushes `manifest` events; refetch and keep the selection. */
function subscribeToManifestEvents(): () => void {
  const events = new EventSource('/api/events');
  events.addEventListener('manifest', () => {
    loadManifest()
      .then(({ widgets, errors }) => useStudioStore.getState().replaceWidgets(widgets, errors))
      .catch(() => {});
  });
  return () => events.close();
}

export function App() {
  useEffect(() => {
    window.__mcpStudio = { getLog: () => structuredClone(useStudioStore.getState().log) };
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    loadManifest()
      .then(({ widgets, errors }) => {
        if (cancelled) return;
        useStudioStore.getState().setWidgets(widgets);
        useStudioStore.getState().replaceWidgets(widgets, errors);
        applyDeepLink(window.location.search);
        unsubscribe = subscribeToManifestEvents();
      })
      .catch(() => {
        if (!cancelled && useStudioStore.getState().widgets.length === 0) {
          useStudioStore.getState().setWidgets([demoWidget]);
          applyDeepLink(window.location.search);
        }
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <span className="brand">
          MCP Apps <em>Studio</em>
        </span>
        <HeaderControls />
      </header>
      <Canvas />
      <TracePanel />
    </div>
  );
}
