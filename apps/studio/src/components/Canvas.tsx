import { useEffect, useRef } from 'react';
import { HostEmulator, IframeTransport, McpAppsAdapter } from '@studio/host-emulator';
import { scenarios, useStudioStore } from '../store.js';
import widgetHtml from '../demo/kpi-widget.html?raw';

export function Canvas() {
  const scenario = useStudioStore((s) => s.scenario);
  const hostContext = useStudioStore((s) => s.hostContext);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const emulatorRef = useRef<HostEmulator | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const transport = new IframeTransport(iframe);
    const emulator = new HostEmulator({
      adapter: new McpAppsAdapter(),
      transport,
      mocks: scenarios[scenario],
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
  }, [scenario]);

  useEffect(() => {
    const emulator = emulatorRef.current;
    if (emulator && emulator.getHostContext() !== hostContext) {
      emulator.setHostContext(hostContext);
    }
  }, [hostContext]);

  return (
    <main className="canvas">
      <div className="viewport">
        <iframe
          key={scenario}
          ref={iframeRef}
          title="widget under test"
          sandbox="allow-scripts"
          srcDoc={widgetHtml}
        />
      </div>
    </main>
  );
}
