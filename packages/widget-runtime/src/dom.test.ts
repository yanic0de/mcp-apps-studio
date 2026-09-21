import { describe, expect, it } from 'vitest';
import { applyHostContextToDocument, type ThemableDocument } from './dom.js';

function fakeDoc() {
  const props: Record<string, string> = {};
  const doc: ThemableDocument = {
    documentElement: {
      dataset: {},
      style: {
        setProperty: (k, v) => {
          props[k] = v;
        },
      },
    },
  };
  return { doc, props };
}

describe('applyHostContextToDocument', () => {
  it('sets data-theme and CSS variables', () => {
    const { doc, props } = fakeDoc();
    applyHostContextToDocument({ theme: 'dark', styles: { variables: { '--color-bg': '#111' } } }, doc);
    expect(doc.documentElement.dataset.theme).toBe('dark');
    expect(props['--color-bg']).toBe('#111');
  });

  it('tolerates partial context', () => {
    const { doc } = fakeDoc();
    expect(() => applyHostContextToDocument({}, doc)).not.toThrow();
    expect(doc.documentElement.dataset.theme).toBeUndefined();
  });
});
