import type { HostContext } from '@studio/shared';

export interface ThemableDocument {
  documentElement: {
    dataset: Record<string, string>;
    style: { setProperty(name: string, value: string): void };
  };
}

/** Applies host theme + style variables to the widget document (data-theme attr + CSS custom properties). */
export function applyHostContextToDocument(
  ctx: Partial<HostContext>,
  doc: ThemableDocument = document as unknown as ThemableDocument,
): void {
  if (ctx.theme) {
    doc.documentElement.dataset['theme'] = ctx.theme;
  }
  const variables = ctx.styles?.variables;
  if (variables) {
    for (const [name, value] of Object.entries(variables)) {
      doc.documentElement.style.setProperty(name, value);
    }
  }
}
