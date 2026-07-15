import { useEffect, useRef, useState } from 'react';
import { HostEmulator, IframeTransport, McpAppsAdapter } from '@studio/host-emulator';
import { connectExampleServer, type LiveConnection } from '../mcp-client.js';
import { scenarios, useStudioStore } from '../store.js';
import widgetHtml from '../demo/kpi-widget.html?raw';

export function Canvas() {
  const scenario = useStudioStore((s) => s.scenario);
  const hostContext = useStudioStore((s) => s.hostContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emulatorRef = useRef<HostEmulator | null>(null);
  const [live, setLive] = useState<LiveConnection | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    setLive(null);
    setLiveError(null);
    if (scenario !== 'live') return;
    let cancelled = false;
    let connection: LiveConnection | null = null;
    connectExampleServer()
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
  }, [scenario]);

  const waitingForServer = scenario === 'live' && !live;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || waitingForServer) return;
    const transport = new IframeTransport(iframe);
    const emulator = new HostEmulator({
      adapter: new McpAppsAdapter(),
      transport,
      mocks: scenarios[scenario],
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
  }, [scenario, live, waitingForServer]);

  useEffect(() => {
    const emulator = emulatorRef.current;
    if (emulator && emulator.getHostContext() !== hostContext) {
      emulator.setHostContext(hostContext);
    }
  }, [hostContext]);

  if (liveError) {
    return (
      <main className="canvas">
        <p className="canvas-note">
          Can't reach the example server: {liveError}. Start it with{' '}
          <code>pnpm -F @studio/example-server dev</code> and switch the scenario again.
        </p>
      </main>
    );
  }

  if (waitingForServer) {
    return (
      <main className="canvas">
        <p className="canvas-note">Connecting to example server…</p>
      </main>
    );
  }

  return (
    <main className="canvas">
      <div className="viewport">
        <iframe
          key={scenario}
          ref={iframeRef}
          title="widget under test"
          sandbox="allow-scripts"
          srcDoc={scenario === 'live' && live ? live.widgetHtml : widgetHtml}
        />
      </div>
    </main>
  );
}
