// Usage: node build-email.mjs <option-dir> <out.html>
// Renders the partner-invite email from one token set the way mail clients need it: table
// layout, every value inlined as a literal from the light mode (Gmail, Outlook and German
// webmail ignore CSS variables and prefers-color-scheme), the token font first and a
// system stack after it. Research output only: inline styles break the site CSP.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const dir = resolve(process.argv[2]);
const t = JSON.parse(readFileSync(join(dir, 'tokens.json'), 'utf8'));
const c = (k) => { const v = t.color.light[k]?.$value; return v && (typeof v === 'string' ? v : v.hex); };
const fam = (ref) => {
  const key = String(ref).replace(/[{}]/g, '').split('.').pop();
  const v = [t.font.family[key]?.$value ?? ref].flat();
  return `'${v[0]}', ${/serif/i.test(v.join(' ')) && !/sans/i.test(v.join(' ')) ? "Georgia, 'Times New Roman', serif" : "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"}`;
};
const ty = (k) => t.type[k]?.$value;
const size = (v) => (v.unit === 'rem' ? v.value * 16 : v.value);
const head = ty('headline') ?? ty('title');
const body = ty('body');
const r = (k) => { const v = t.radius?.[k]?.$value; return v ? Math.min(size(v), 24) : 8; };
const radiusKey = Object.keys(t.radius).find((k) => !k.startsWith('$') && size(t.radius[k].$value) >= 8) ?? 'm';

const html = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Lea hat dich zu Hummlist eingeladen</title></head>
<body style="margin:0;padding:0;background:${c('surface')};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c('surface')};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${c('surface-raised')};border:1px solid ${c('border')};border-radius:${r(radiusKey)}px;">
<tr><td style="background:${c('brand')};color:${c('on-brand')};padding:20px 24px;border-radius:${r(radiusKey)}px ${r(radiusKey)}px 0 0;font-family:${fam(head.fontFamily)};font-size:20px;font-weight:700;">Hummlist</td></tr>
<tr><td style="padding:28px 24px 8px;font-family:${fam(head.fontFamily)};font-size:${Math.min(size(head.fontSize), 28)}px;line-height:1.2;font-weight:${head.fontWeight};color:${c('text')};">Lea hat dich zu Hummlist eingeladen</td></tr>
<tr><td style="padding:8px 24px 20px;font-family:${fam(body.fontFamily)};font-size:16px;line-height:1.55;color:${c('text')};">Hallo Peter,<br>Lea möchte die Einkaufsliste „Familieneinkauf“ mit dir teilen. Was einer von euch einträgt, sehen alle anderen sofort.</td></tr>
<tr><td style="padding:0 24px 24px;"><a href="#" style="display:inline-block;background:${c('brand')};color:${c('on-brand')};font-family:${fam(body.fontFamily)};font-size:16px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:${r(radiusKey)}px;">Einladung annehmen</a></td></tr>
<tr><td style="padding:0 24px 24px;font-family:${fam(body.fontFamily)};font-size:14px;line-height:1.5;color:${c('text-muted')};">Die Einladung gilt 7 Tage. Hummlist zeigt keine Werbung und verkauft keine Daten.</td></tr>
</table>
<p style="font-family:${fam(body.fontFamily)};font-size:12px;color:${c('text-muted')};margin:16px 0 0;">${basename(dir)}: Werte aus tokens.json (hell), inline gesetzt.</p>
</td></tr></table>
</body></html>
`;
writeFileSync(resolve(process.argv[3]), html);
