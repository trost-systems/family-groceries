// Inline styles and the one <style> block, all from the tokens. Core layout lives in inline
// styles (Gmail, Outlook); the <style> block only adds dark mode, the narrow-screen padding and
// Outlook's font fallback, so a client that drops it still gets the light layout.
import { border, color, depth, font, radius, space, target, typography, weight } from './tokens.ts';

const light = color.light;
const dark = color.dark;

export const CONTAINER = 600;
export const MOBILE = 480;

export const text = {
  body: { fontFamily: font.body, fontSize: `${typography.body.size}px`, lineHeight: `${typography.body.line}`, color: light.text, margin: `0 0 ${space[4]}px 0` },
  muted: { fontFamily: font.body, fontSize: `${typography.label.size}px`, lineHeight: '1.5', color: light['text-muted'], margin: `0 0 ${space[3]}px 0` },
  heading: { fontFamily: font.display, fontSize: `${typography.headline.size}px`, fontWeight: typography.headline.weight, lineHeight: '1.1', color: light.text, margin: `0 0 ${space[4]}px 0` },
  stepTitle: { fontFamily: font.display, fontSize: `${typography.body.size}px`, fontWeight: weight.bold, lineHeight: '1.3', color: light.text, margin: `${space[1]}px 0 ${space[2]}px 0` },
  wordmark: { fontFamily: font.display, fontSize: `${typography.title.size}px`, fontWeight: weight.heavy, lineHeight: '1', color: light.text, letterSpacing: '-0.01em' },
} as const;

export const link = { color: light.accent, textDecoration: 'underline' } as const;

export const css = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
@media only screen and (max-width: ${MOBILE}px) {
  .hl-card-pad { padding: ${space[5]}px ${space[4]}px ${space[1]}px ${space[4]}px !important; }
  .hl-gutter { padding-left: ${space[2]}px !important; padding-right: ${space[2]}px !important; }
  .hl-heading { font-size: ${typography.title.size}px !important; }
  .hl-btn-table { width: 100% !important; }
}
@media (prefers-color-scheme: dark) {
  .hl-page { background-color: ${dark.surface} !important; }
  .hl-card { background-color: ${dark['surface-raised']} !important; border-color: ${dark.border} !important; }
  .hl-text { color: ${dark.text} !important; }
  .hl-muted { color: ${dark['text-muted']} !important; }
  .hl-link { color: ${dark.accent} !important; }
  .hl-tip { background-color: ${dark['honey-soft']} !important; border-color: ${dark.honey} !important; }
  .hl-sunken { background-color: ${dark['surface-sunken']} !important; border-color: ${dark.divider} !important; }
  .hl-honey { background-color: ${dark.honey} !important; color: ${dark['on-honey']} !important; border-color: ${dark.ink} !important; }
}
[data-ogsc] .hl-text { color: ${dark.text} !important; }
[data-ogsc] .hl-muted { color: ${dark['text-muted']} !important; }
[data-ogsc] .hl-link { color: ${dark.accent} !important; }
[data-ogsb] .hl-page { background-color: ${dark.surface} !important; }
[data-ogsb] .hl-card { background-color: ${dark['surface-raised']} !important; }
`;

// Outlook on Windows renders with Word, which drops to Times New Roman when the first family
// in a stack is not installed instead of trying the next one.
export const msoHead = `<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><style>table, td, p, a, span, h1, div { font-family: Arial, Helvetica, sans-serif !important; }</style><![endif]-->`;

export const ui = {
  light,
  dark,
  space,
  radius,
  border,
  depth,
  target,
  typography,
  weight,
  font,
};
