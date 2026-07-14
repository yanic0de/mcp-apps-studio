import type { Transport } from './transport.js';

interface MessageSource {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface IframeLike {
  readonly contentWindow: MessageSource | null;
}

export interface ListeningWindow {
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
}

/**
 * Host-side transport bound to a sandboxed iframe. Sandboxed widgets run with a
 * null origin, so postMessage must use targetOrigin '*' and the ONLY trust
 * signal for incoming messages is `event.source === iframe.contentWindow`.
 */
export class IframeTransport implements Transport {
  private readonly handlers = new Set<(message: unknown) => void>();
  private readonly listener: (ev: MessageEvent) => void;

  constructor(
    private readonly iframe: IframeLike,
    private readonly listeningWindow: ListeningWindow = window,
  ) {
    this.listener = (ev) => {
      const cw = this.iframe.contentWindow;
      if (!cw || ev.source !== cw) return;
      for (const h of [...this.handlers]) h(ev.data);
    };
    this.listeningWindow.addEventListener('message', this.listener);
  }

  send(message: unknown): void {
    this.iframe.contentWindow?.postMessage(message, '*');
  }

  onMessage(handler: (message: unknown) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  dispose(): void {
    this.listeningWindow.removeEventListener('message', this.listener);
    this.handlers.clear();
  }
}
