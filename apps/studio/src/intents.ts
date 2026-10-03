import type { WidgetIntent } from '@studio/host-emulator';

export interface IntentDescription {
  kind: string;
  text: string;
  /** Set only for http(s) links: nothing else is ever rendered clickable. */
  href?: string;
}

const MAX = 200;
const clip = (s: string) => (s.length > MAX ? `${s.slice(0, MAX - 1)}…` : s);
const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
const blocks = (content: { type: string; text?: unknown }[] = []) =>
  content.map((b) => (b.type === 'text' && typeof b.text === 'string' ? b.text : `[${b.type}]`)).join(' ');

/** One line per thing the widget asked the host to do — the studio shows these, it never acts on them. */
export function describeIntent(intent: WidgetIntent): IntentDescription {
  switch (intent.type) {
    case 'open-link': {
      const href = /^https?:\/\//i.test(intent.url) ? intent.url : undefined;
      return { kind: 'Open link', text: clip(intent.url), ...(href ? { href } : {}) };
    }
    case 'message':
      return { kind: 'Message', text: clip(blocks(intent.content)) };
    case 'update-model-context':
      return {
        kind: 'Model context',
        text: clip(
          [blocks(intent.content), intent.structuredContent ? show(intent.structuredContent) : ''].join(' ').trim(),
        ),
      };
    case 'download-file':
      return { kind: 'Download', text: `${intent.contents.length} file${intent.contents.length === 1 ? '' : 's'}` };
    case 'log':
      return {
        kind: 'Log',
        text: clip(`${intent.level}${intent.logger ? ` ${intent.logger}` : ''}: ${show(intent.data)}`),
      };
    case 'request-teardown':
      return { kind: 'Close widget', text: 'The widget asked the host to close it' };
  }
}
