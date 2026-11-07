// Element builders. Text always goes in as a text node, never as HTML, so a PR title cannot inject
// markup; with CSP `script-src 'self'` there is no inline script or style either.

export type Child = Node | string | number | null | false;
type Attrs = Record<string, string | number | boolean | null | undefined>;

function fill(el: Element, attrs: Attrs, children: readonly Child[]): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  fill(el, attrs, children);
  return el;
}

const svgNs = 'http://www.w3.org/2000/svg';

export function s(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const el = document.createElementNS(svgNs, tag);
  fill(el, attrs, children);
  return el;
}

/** A pointy-top hexagon, 41.569 x 48 (site/public/hex/hex-pointy.svg's outline); the marker's round stroke join softens its corners. */
export const hexPath = 'M20.785 0L41.569 12V36L20.785 48L0 36V12Z';

/** A state marker: a small hex whose fill is the tone; the label beside it carries the meaning. */
export function hex(tone: string, size = 14): SVGElement {
  return s(
    'svg',
    {
      class: `hexmark tone-${tone}`,
      viewBox: '-3 -3 47.569 54',
      width: Math.round(size * 0.866),
      height: size,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    s('path', { d: hexPath }),
  );
}
