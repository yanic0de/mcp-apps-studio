import type { WidgetManifestEntry } from '@studio/shared';
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

async function loadManifest(): Promise<WidgetManifestEntry[]> {
  const res = await fetch('/api/manifest');
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    throw new Error('no manifest');
  }
  const body = (await res.json()) as { widgets?: WidgetManifestEntry[] };
  if (!body.widgets?.length) throw new Error('empty manifest');
  return body.widgets;
}

export function App() {
  useEffect(() => {
    window.__mcpStudio = { getLog: () => structuredClone(useStudioStore.getState().log) };
    let cancelled = false;
    loadManifest()
      .then((widgets) => {
        if (cancelled) return;
        useStudioStore.getState().setWidgets(widgets);
        applyDeepLink(window.location.search);
      })
      .catch(() => {
        if (!cancelled && useStudioStore.getState().widgets.length === 0) {
          useStudioStore.getState().setWidgets([demoWidget]);
          applyDeepLink(window.location.search);
        }
      });
    return () => {
      cancelled = true;
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
