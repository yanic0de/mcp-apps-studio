import type { WidgetManifestEntry } from '@studio/shared';
import { useEffect } from 'react';
import { Canvas } from './components/Canvas.js';
import { HeaderControls } from './components/HeaderControls.js';
import { TracePanel } from './components/TracePanel.js';
import { demoWidget } from './demo.js';
import { useStudioStore } from './store.js';

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
    let cancelled = false;
    loadManifest()
      .then((widgets) => {
        if (!cancelled) useStudioStore.getState().setWidgets(widgets);
      })
      .catch(() => {
        if (!cancelled && useStudioStore.getState().widgets.length === 0) {
          useStudioStore.getState().setWidgets([demoWidget]);
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
