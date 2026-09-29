import { describe, expect, it } from 'vitest';
import { describeIntent } from './intents.js';

describe('describeIntent', () => {
  it('open-link: clickable only for http(s)', () => {
    expect(describeIntent({ type: 'open-link', url: 'https://example.com/docs' })).toEqual({
      kind: 'Open link',
      text: 'https://example.com/docs',
      href: 'https://example.com/docs',
    });
    expect(describeIntent({ type: 'open-link', url: 'mailto:a@example.com' }).href).toBeUndefined();
  });

  it('message: the text blocks, other blocks by type', () => {
    const d = describeIntent({
      type: 'message',
      role: 'user',
      content: [{ type: 'text', text: 'Summarize this' }, { type: 'image' }],
    });
    expect(d).toMatchObject({ kind: 'Message' });
    expect(d.text).toContain('Summarize this');
    expect(d.text).toContain('[image]');
  });

  it('model context, download, log and teardown', () => {
    expect(describeIntent({ type: 'update-model-context', structuredContent: { a: 1 } }).kind).toBe('Model context');
    expect(describeIntent({ type: 'download-file', contents: [{}, {}] }).text).toBe('2 files');
    expect(describeIntent({ type: 'log', level: 'warning', logger: 'w', data: 'slow' })).toEqual({
      kind: 'Log',
      text: 'warning w: slow',
    });
    expect(describeIntent({ type: 'request-teardown' }).kind).toBe('Close widget');
  });

  it('keeps long texts short', () => {
    expect(
      describeIntent({ type: 'message', role: 'user', content: [{ type: 'text', text: 'x'.repeat(500) }] }).text.length,
    ).toBeLessThanOrEqual(200);
  });
});
