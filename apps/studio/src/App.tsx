import { useEffect } from 'react';
import { type AutomationHook, createAutomationHook } from './automation.js';
import { Canvas } from './components/Canvas.js';
import { HeaderControls } from './components/HeaderControls.js';
import { TracePanel } from './components/TracePanel.js';
import { applyDeepLink } from './deep-link.js';
import { demoWidget } from './demo.js';
import { loadManifest, widgetsForManifest } from './manifest.js';
import { useStudioStore } from './store.js';

declare global {
  interface Window {
    /** Read-only automation hook (used by `mcp-apps-studio test`). */
    __mcpStudio?: AutomationHook;
  }
}

/** CLI live reload: the watcher pushes `manifest` events; refetch and keep the selection. */
function subscribeToManifestEvents(): () => void {
  const events = new EventSource('/api/events');
  events.addEventListener('manifest', () => {
    loadManifest()
      .then((manifest) => useStudioStore.getState().replaceWidgets(widgetsForManifest(manifest), manifest.errors))
      .catch(() => {}); // a story mid-edit: keep what is shown, the next save reloads again
  });
  return () => events.close();
}

export function App() {
  useEffect(() => {
    window.__mcpStudio = createAutomationHook(useStudioStore.getState);
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    loadManifest()
      .then((manifest) => {
        if (cancelled) return;
        const widgets = widgetsForManifest(manifest);
        useStudioStore.getState().setWidgets(widgets);
        useStudioStore.getState().replaceWidgets(widgets, manifest.errors);
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
