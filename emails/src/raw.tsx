// React cannot emit HTML comments, and Outlook's conditional comments carry the VML button and
// the fixed-width ghost tables. <Raw> marks verbatim HTML; render.ts unwraps it after rendering.
import { createElement } from 'react';

export const RAW_TAG = 'hl-raw';

export function Raw({ html }: { html: string }) {
  return createElement(RAW_TAG, { dangerouslySetInnerHTML: { __html: html } });
}

export const mso = (html: string) => `<!--[if mso]>${html}<![endif]-->`;

export function unwrapRaw(html: string): string {
  return html.replace(new RegExp(`<${RAW_TAG}>([\\s\\S]*?)</${RAW_TAG}>`, 'g'), '$1');
}
