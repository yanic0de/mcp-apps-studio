// Test-only helper: a real HostEmulator on the other end of an in-memory transport.
import {
  createInMemoryTransportPair,
  HostEmulator,
  type HostEmulatorOptions,
  McpAppsAdapter,
  toMcpTransport,
} from '@studio/host-emulator';

export function emulatorHost(opts: Partial<Omit<HostEmulatorOptions, 'adapter' | 'transport'>> = {}) {
  const [hostEnd, appEnd] = createInMemoryTransportPair();
  const emulator = new HostEmulator({ adapter: new McpAppsAdapter(), transport: hostEnd, ...opts });
  emulator.start();
  return { emulator, transport: toMcpTransport(appEnd) };
}

export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
