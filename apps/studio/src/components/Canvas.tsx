import { HostEmulator, IframeTransport } from '@studio/host-emulator';
import type { WidgetManifestEntry, WidgetSource } from '@studio/shared';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { adapter } from '../adapter.js';
import { connectMcpServer, type LiveConnection } from '../mcp-client.js';
import { selectActiveWidget, useStudioStore } from '../store.js';
import { containerDimensions, frameSize, type Size } from '../viewport.js';
import { HostRequests } from './HostRequests.js';

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

const WIDGET_TITLE = 'widget under test';

/** Manifest widgets have no server-side uri; a studio-local one keeps WidgetSource honest. */
function widgetSource(widget: WidgetManifestEntry, live: LiveConnection | null): WidgetSource {
  if (live) return { kind: 'resource', uri: live.widgetUri, html: live.widgetHtml };
  return widget.url !== undefined
    ? { kind: 'dev', url: widget.url } // dev server: loaded with src so its HMR client runs
    : { kind: 'resource', uri: `ui://studio/${widget.id}`, html: widget.html };
}

/**
 * The widget frame is created and removed here, not rendered by React: React removes a keyed element before
 * effect cleanups run, which would leave `ui/resource-teardown` addressed to a frame that no longer exists.
 */
function createWidgetFrame(source: WidgetSource): HTMLIFrameElement {
  const env = adapter.buildIframeEnv(source, useStudioStore.getState().hostContext);
  const iframe = document.createElement('iframe');
  iframe.title = WIDGET_TITLE;
  iframe.setAttribute('sandbox', env.sandbox.join(' '));
  if (env.csp) iframe.setAttribute('csp', env.csp);
  if (env.mode === 'srcdoc') iframe.srcdoc = env.content;
  else iframe.src = env.content;
  return iframe;
}

export function Canvas() {
  const activeWidget = useStudioStore(selectActiveWidget);
  const scenario = useStudioStore((s) => s.scenario);
  const hostContext = useStudioStore((s) => s.hostContext);
  const device = useStudioStore((s) => s.device);
  const revision = useStudioStore((s) => s.revision);
  const errors = useStudioStore((s) => s.errors);
  const canvasRef = useRef<HTMLElement>(null);
  const canvasSize = useElementSize(canvasRef);
  const [reportedHeight, setReportedHeight] = useState<number | undefined>(undefined);
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [frameMounted, setFrameMounted] = useState(false);
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
        useStudioStore.getState().setLiveToolName(c.linkedTool?.name ?? null);
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

  const displayMode = hostContext.displayMode;
  const frame = activeWidget ? frameSize(displayMode, device, reportedHeight, canvasSize) : undefined;
  const frameStyle = frame ? { width: `${frame.width}px`, height: `${frame.height}px` } : {};
  // Read by the frame-creating effect without making a resize recreate the widget.
  const frameStyleRef = useRef(frameStyle);
  frameStyleRef.current = frameStyle;
  const frameWidth = frameStyle.width;
  const frameHeight = frameStyle.height;
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!frameMounted || !iframe || frameWidth === undefined || frameHeight === undefined) return;
    iframe.style.width = frameWidth;
    iframe.style.height = frameHeight;
  }, [frameWidth, frameHeight, frameMounted]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision means a new frame, so the emulator must follow
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !activeWidget || waitingForServer) return;
    setReportedHeight(undefined); // a new iframe starts from the default height
    const iframe = createWidgetFrame(widgetSource(activeWidget, live));
    Object.assign(iframe.style, frameStyleRef.current);
    viewport.append(iframe);
    iframeRef.current = iframe;
    setFrameMounted(true);
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
      onWidgetIntent: (intent) => useStudioStore.getState().appendIntent(intent),
      onSizeChanged: ({ height }) => {
        if (height !== undefined) setReportedHeight(height);
      },
    });
    emulator.start();
    emulatorRef.current = emulator;
    return () => {
      // Like a real host: ask the widget to tear down before the frame goes. The frame stays in the DOM,
      // hidden and renamed so it is never mistaken for the current widget, until the answer or the timeout.
      iframe.title = 'retiring widget';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.display = 'none';
      iframeRef.current = null;
      emulatorRef.current = null;
      setFrameMounted(false);
      void emulator.teardown().finally(() => {
        transport.dispose();
        iframe.remove();
      });
    };
  }, [activeWidget, scenario, live, waitingForServer, revision]);

  useEffect(() => {
    const emulator = emulatorRef.current;
    if (emulator && emulator.getHostContext() !== hostContext) {
      emulator.setHostContext(hostContext);
    }
  }, [hostContext]);

  // The host tells the widget its bounds; only real changes go out, so canvas resizes don't flood the widget.
  useEffect(() => {
    if (canvasSize.width === 0) return;
    const next = containerDimensions(displayMode, device, canvasSize);
    const { hostContext: current, setHostContext } = useStudioStore.getState();
    if (JSON.stringify(current.containerDimensions) !== JSON.stringify(next)) {
      setHostContext({ containerDimensions: next });
    }
  }, [displayMode, device, canvasSize]);

  const note = !activeWidget ? (
    <p className="canvas-note">Loading widget manifest…</p>
  ) : liveError ? (
    <p className="canvas-note">
      Can't reach the MCP server: {liveError}. Start one (e.g. <code>pnpm -F @studio/example-server dev</code>) or point
      the studio at another with <code>?server=&lt;url&gt;</code>, then switch the scenario again.
    </p>
  ) : waitingForServer ? (
    <p className="canvas-note">Connecting to MCP server…</p>
  ) : null;

  // One tree in every state: the viewport stays mounted so a retiring frame survives until its teardown ends.
  return (
    <main className="canvas" ref={canvasRef}>
      {note}
      {activeWidget && errors.length > 0 && (
        <div className="canvas-errors" role="alert">
          {errors.map((e) => (
            <p key={e.file}>
              <code>{e.file}</code> {e.message}
            </p>
          ))}
        </div>
      )}
      <div
        className={`viewport viewport--${displayMode}`}
        data-testid="viewport"
        ref={viewportRef}
        hidden={note !== null}
      />
      <HostRequests />
    </main>
  );
}
