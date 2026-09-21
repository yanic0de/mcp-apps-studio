import { HostEmulator, IframeTransport } from '@studio/host-emulator';
import type { WidgetSource } from '@studio/shared';
import { useEffect, useRef, useState } from 'react';
import { adapter } from '../adapter.js';
import { connectMcpServer, type LiveConnection } from '../mcp-client.js';
import { selectActiveWidget, useStudioStore } from '../store.js';

export function Canvas() {
  const activeWidget = useStudioStore(selectActiveWidget);
  const scenario = useStudioStore((s) => s.scenario);
  const hostContext = useStudioStore((s) => s.hostContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emulatorRef = useRef<HostEmulator | null>(null);
  const [live, setLive] = useState<LiveConnection | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const widgetId = activeWidget?.id ?? null;
  const isLive = scenario === 'live';

  // biome-ignore lint/correctness/useExhaustiveDependencies: reconnect when the active widget changes, not only on the live toggle
  useEffect(() => {
    setLive(null);
    setLiveError(null);
    if (!isLive) return;
    let cancelled = false;
    let connection: LiveConnection | null = null;
    connectMcpServer()
      .then((c) => {
        if (cancelled) return void c.close();
        connection = c;
        setLive(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLiveError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      void connection?.close();
    };
  }, [isLive, widgetId]);

  const waitingForServer = isLive && !live;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !activeWidget || waitingForServer) return;
    const transport = new IframeTransport(iframe);
    const emulator = new HostEmulator({
      adapter,
      transport,
      mocks: activeWidget.scenarios[scenario]?.mocks ?? {},
      passthrough: live?.callTool,
      hostContext: useStudioStore.getState().hostContext,
      onLog: (ev) => useStudioStore.getState().appendLog(ev),
    });
    emulator.start();
    emulatorRef.current = emulator;
    return () => {
      emulator.stop();
      transport.dispose();
      emulatorRef.current = null;
    };
  }, [activeWidget, scenario, live, waitingForServer]);

  useEffect(() => {
    const emulator = emulatorRef.current;
    if (emulator && emulator.getHostContext() !== hostContext) {
      emulator.setHostContext(hostContext);
    }
  }, [hostContext]);

  if (!activeWidget) {
    return (
      <main className="canvas">
        <p className="canvas-note">Loading widget manifest…</p>
      </main>
    );
  }

  if (liveError) {
    return (
      <main className="canvas">
        <p className="canvas-note">
          Can't reach the MCP server: {liveError}. Start one (e.g. <code>pnpm -F @studio/example-server dev</code>) or
          point the studio at another with <code>?server=&lt;url&gt;</code>, then switch the scenario again.
        </p>
      </main>
    );
  }

  if (waitingForServer) {
    return (
      <main className="canvas">
        <p className="canvas-note">Connecting to MCP server…</p>
      </main>
    );
  }

  // Manifest widgets have no server-side uri; a studio-local one keeps WidgetSource honest.
  const source: WidgetSource = live
    ? { kind: 'resource', uri: live.widgetUri, html: live.widgetHtml }
    : { kind: 'resource', uri: `ui://studio/${activeWidget.id}`, html: activeWidget.html };
  const env = adapter.buildIframeEnv(source, hostContext);

  return (
    <main className="canvas">
      <div className="viewport">
        <iframe
          key={`${activeWidget.id}:${scenario}`}
          ref={iframeRef}
          title="widget under test"
          sandbox={env.sandbox.join(' ')}
          {...(env.mode === 'srcdoc' ? { srcDoc: env.content } : { src: env.content })}
          {...(env.csp ? { csp: env.csp } : {})}
        />
      </div>
    </main>
  );
}
