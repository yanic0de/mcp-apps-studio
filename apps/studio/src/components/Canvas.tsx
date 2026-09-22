import { HostEmulator, IframeTransport } from '@studio/host-emulator';
import type { WidgetSource } from '@studio/shared';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { adapter } from '../adapter.js';
import { connectMcpServer, type LiveConnection } from '../mcp-client.js';
import { selectActiveWidget, useStudioStore } from '../store.js';
import { containerDimensions, frameSize, type Size } from '../viewport.js';

/** Tracks the canvas box; the only DOM measurement the layout needs. */
function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = { width: Math.round(el.clientWidth), height: Math.round(el.clientHeight) };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function Canvas() {
  const activeWidget = useStudioStore(selectActiveWidget);
  const scenario = useStudioStore((s) => s.scenario);
  const hostContext = useStudioStore((s) => s.hostContext);
  const device = useStudioStore((s) => s.device);
  const canvasRef = useRef<HTMLElement>(null);
  const canvasSize = useElementSize(canvasRef);
  const [reportedHeight, setReportedHeight] = useState<number | undefined>(undefined);
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
    setReportedHeight(undefined); // a new iframe starts from the default height
    const transport = new IframeTransport(iframe);
    const scenarioConfig = activeWidget.scenarios[scenario];
    // Live: the "model" calls the tool linked to the widget through the real server, unless the scenario overrides it.
    const toolCall = live
      ? {
          ...scenarioConfig?.toolCall,
          name: scenarioConfig?.toolCall?.name ?? live.linkedTool?.name,
          result: scenarioConfig?.toolCall?.result ?? { kind: 'passthrough' as const },
        }
      : scenarioConfig?.toolCall;
    const emulator = new HostEmulator({
      adapter,
      transport,
      mocks: scenarioConfig?.mocks ?? {},
      toolCall,
      toolDefinition: live?.linkedTool?.name === toolCall?.name ? live?.linkedTool : undefined,
      passthrough: live?.callTool,
      hostContext: useStudioStore.getState().hostContext,
      onLog: (ev) => useStudioStore.getState().appendLog(ev),
      onHostContextChanged: (ctx) => useStudioStore.getState().replaceHostContext(ctx),
      onSizeChanged: ({ height }) => {
        if (height !== undefined) setReportedHeight(height);
      },
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

  // The host tells the widget its bounds; only real changes go out, so canvas resizes don't flood the widget.
  const displayMode = hostContext.displayMode;
  useEffect(() => {
    if (canvasSize.width === 0) return;
    const next = containerDimensions(displayMode, device, canvasSize);
    const { hostContext: current, setHostContext } = useStudioStore.getState();
    if (JSON.stringify(current.containerDimensions) !== JSON.stringify(next)) {
      setHostContext({ containerDimensions: next });
    }
  }, [displayMode, device, canvasSize]);

  if (!activeWidget) {
    return (
      <main className="canvas" ref={canvasRef}>
        <p className="canvas-note">Loading widget manifest…</p>
      </main>
    );
  }

  if (liveError) {
    return (
      <main className="canvas" ref={canvasRef}>
        <p className="canvas-note">
          Can't reach the MCP server: {liveError}. Start one (e.g. <code>pnpm -F @studio/example-server dev</code>) or
          point the studio at another with <code>?server=&lt;url&gt;</code>, then switch the scenario again.
        </p>
      </main>
    );
  }

  if (waitingForServer) {
    return (
      <main className="canvas" ref={canvasRef}>
        <p className="canvas-note">Connecting to MCP server…</p>
      </main>
    );
  }

  // Manifest widgets have no server-side uri; a studio-local one keeps WidgetSource honest.
  const source: WidgetSource = live
    ? { kind: 'resource', uri: live.widgetUri, html: live.widgetHtml }
    : { kind: 'resource', uri: `ui://studio/${activeWidget.id}`, html: activeWidget.html };
  const env = adapter.buildIframeEnv(source, hostContext);
  const frame = frameSize(displayMode, device, reportedHeight, canvasSize);

  return (
    <main className="canvas" ref={canvasRef}>
      <div className={`viewport viewport--${displayMode}`} data-testid="viewport">
        <iframe
          style={{ width: frame.width, height: frame.height }}
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
