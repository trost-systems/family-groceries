import type { ReactElement, ReactNode } from 'react';
import { link, text } from '../theme.ts';

/** The mail's one headline (Bricolage, `type.headline`, `type.title` on phones). */
export function Heading({ children }: { children: ReactNode }): ReactElement {
  return <h1 className="hl-text hl-heading" style={text.heading}>{children}</h1>;
}

/** The opening line, e.g. "Hi Anna, schön, dass ihr dabei seid!". */
export function Greeting({ children }: { children: ReactNode }): ReactElement {
  return <p className="hl-text" style={text.body}>{children}</p>;
}

/** One body paragraph. Use <strong> for a lead-in like "Wichtig:". */
export function Paragraph({ children }: { children: ReactNode }): ReactElement {
  return <p className="hl-text" style={text.body}>{children}</p>;
}

/** An inline link in body text. Plain text prints the URL after the words. */
export function TextLink({ href, children }: { href: string; children: ReactNode }): ReactElement {
  return <a href={href} target="_blank" className="hl-link" style={link}>{children}</a>;
}

/** The sign-off: "Peter". */
export function Signature({ children = 'Peter' }: { children?: string }): ReactElement {
  return <p className="hl-text" style={{ ...text.body, fontWeight: 600, margin: 0 }}>{children}</p>;
}

/**
 * Body text nobody has written for real yet (e.g. "[DRAFT] Dein Konto ist gelöscht."). It shows
 * as a draft and a production render refuses it; Launch replaces it with a Paragraph.
 */
export function Draft({ children }: { children: string }): ReactElement {
  return <p className="hl-text" data-hl-draft="body text, Launch to write" style={text.body}>[DRAFT] {children}</p>;
}
