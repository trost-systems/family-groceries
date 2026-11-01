// Renders one mail to the HTML and plain text a sender needs, and refuses what must not ship.
import { render } from '@react-email/components';
import type { ReactElement } from 'react';
import { unwrapRaw } from './raw.tsx';

type Builder = {
  openBlock(o?: { leadingLineBreaks?: number }): void;
  closeBlock(o?: { trailingLineBreaks?: number }): void;
  addInline(s: string): void;
  addLineBreak(): void;
};
type Elem = { attribs: Record<string, string>; children: unknown[]; data?: string };
const textOf = (n: Elem): string => n.data ?? (n.children ?? []).map((c) => textOf(c as Elem)).join('');
type Walk = (nodes: unknown[], builder: Builder) => void;

// Plain text: "1. Title" for steps, the button's label over its link, every link's URL on a line
// of its own, "-- " before the footer.
const pendingLinks: string[] = [];
function flushLinks(builder: Builder) {
  for (const line of pendingLinks.splice(0)) {
    builder.addLineBreak();
    builder.addInline(line);
  }
}
const htmlToTextOptions = {
  selectors: [
    { selector: '[data-hl-step]', format: 'hlStep' },
    { selector: '[data-hl-cta]', format: 'hlCta' },
    { selector: '[data-hl-text=footer]', format: 'hlFooter' },
    { selector: 'a', format: 'hlLink' },
    { selector: 'p', format: 'hlParagraph' },
    { selector: 'h1', format: 'hlParagraph' },
  ],
  formatters: {
    hlStep(elem: Elem, walk: Walk, builder: Builder) {
      builder.openBlock({ leadingLineBreaks: 2 });
      builder.addInline(`${elem.attribs['data-hl-step']}. `);
      walk(elem.children, builder);
      builder.closeBlock({ trailingLineBreaks: 1 });
    },
    hlCta(elem: Elem, walk: Walk, builder: Builder) {
      builder.openBlock({ leadingLineBreaks: 1 });
      builder.addInline(`${elem.attribs['data-hl-label']}:`);
      builder.addLineBreak();
      builder.addInline(elem.attribs['data-hl-href']);
      builder.closeBlock({ trailingLineBreaks: 1 });
    },
    // A link inside a sentence keeps the sentence whole; its URL follows the paragraph.
    hlLink(elem: Elem, walk: Walk, builder: Builder) {
      walk(elem.children, builder);
      const href = elem.attribs.href ?? '';
      const label = textOf(elem).trim();
      if (!href.startsWith('mailto:') && label !== href) pendingLinks.push(`${label}: ${href}`);
    },
    hlParagraph(elem: Elem, walk: Walk, builder: Builder) {
      builder.openBlock({ leadingLineBreaks: 2 });
      walk(elem.children, builder);
      flushLinks(builder);
      builder.closeBlock({ trailingLineBreaks: 2 });
    },
    hlFooter(elem: Elem, walk: Walk, builder: Builder) {
      flushLinks(builder);
      builder.openBlock({ leadingLineBreaks: 2 });
      builder.addInline('-- ');
      builder.addLineBreak();
      walk(elem.children, builder);
      builder.closeBlock({ trailingLineBreaks: 1 });
    },
  },
};

export class EmailRenderError extends Error {}

export type Rendered = { html: string; text: string };

export async function renderEmail(element: ReactElement, { production = false } = {}): Promise<Rendered> {
  // React 19 adds an image preload <link> to <head>; a mail has no use for it.
  pendingLinks.length = 0;
  const html = unwrapRaw(await render(element)).replace(/<link rel="preload" as="image"[^>]*\/>/g, '');
  const ctas = html.match(/data-hl-cta="true"/g)?.length ?? 0;
  if (ctas > 1) throw new EmailRenderError(`a mail has one primary button, this one has ${ctas}`);
  if (production) {
    const drafts = [...html.matchAll(/data-hl-draft="([^"]+)"/g)].map((m) => m[1]);
    if (drafts.length) throw new EmailRenderError(`not confirmed yet: ${drafts.join(', ')} (docs/EMAIL.md, "Drafts")`);
    if (/abmelden\?t=demo\b/i.test(html)) throw new EmailRenderError('the unsubscribe link is the demo one; pass the reader\'s');
  }
  const text = (await render(element, { plainText: true, htmlToTextOptions } as Parameters<typeof render>[1]))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^--$/m, '-- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { html, text: `${text}\n` };
}
