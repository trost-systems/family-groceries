#!/usr/bin/env node
// The team's review page of the published store set: site/public/internal/store-frames-final.html
// with WebP copies of every file in store/screenshots/ (site/build.mjs leaves public/internal/ out
// of production builds; the page is noindex). Run after `scripts/store-screenshots.sh --publish`.
//
//   node marketing/store-screenshots/review.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { DEVICES, LOCALES } from './sets.mjs';

const here = new URL('.', import.meta.url).pathname;
const repo = join(here, '../..');
const published = join(repo, 'store/screenshots');
const ASSETS = 'internal/store-frames-final';
const assets = join(repo, 'site/public', ASSETS);
const manifest = JSON.parse(readFileSync(join(published, 'manifest.json'), 'utf8'));
const captions = parse(readFileSync(join(here, 'captions.yaml'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LABELS = {
  'play-phone': 'Google Play, Telefon',
  'appstore-iphone69': 'App Store, iPhone 6,9″ (nimmt auch 6,7″)',
  'appstore-iphone65': 'App Store, iPhone 6,5″',
  'play-tablet7': 'Google Play, Tablet 7″',
  'play-tablet10': 'Google Play, Tablet 10″',
  'appstore-ipad13': 'App Store, iPad 13″',
};

rmSync(assets, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });
const webp = (file) => {
  const name = file.replace(/\//g, '-').replace(/\.png$/, '.webp');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(published, file), '-vf', "scale='min(1080,iw)':-1:flags=lanczos", '-c:v', 'libwebp', '-quality', '88', join(assets, name)]);
  return `/${ASSETS}/${name}`;
};

const files = manifest.files.filter((f) => !f.file.endsWith('icon-512.png'));
const sections = Object.keys(LOCALES).filter((l) => files.some((f) => f.locale === l)).map((locale) => {
  const devices = Object.keys(DEVICES).filter((d) => files.some((f) => f.locale === locale && f.device === d)).map((device) => {
    const { width, height } = DEVICES[device];
    const shots = files.filter((f) => f.locale === locale && f.device === device).map((f) => {
      const c = captions[locale][f.scene];
      const src = webp(f.file);
      return `<figure><a href="${src}"><img src="${src}" alt="${esc(`${c.title.join(' ')} ${c.sub}`)}" width="${width}" height="${height}" loading="lazy"></a><figcaption>${esc(f.file.split('/').pop())} · Text ${(f.textShare * 100).toFixed(1)} %</figcaption></figure>`;
    });
    return `<h3>${esc(LABELS[device])} <span class="size">${width} × ${height}</span></h3><div class="shots${device.includes('tablet') || device.includes('ipad') ? ' wide' : ''}">${shots.join('')}</div>`;
  });
  const fg = files.find((f) => f.locale === locale && f.device === 'play-feature-graphic');
  const feature = fg ? `<h3>Google Play, Feature-Grafik <span class="size">1024 × 500</span></h3><img class="feature" src="${webp(fg.file)}" alt="${esc(`${captions[locale].feature.title} ${captions[locale].feature.accent}`)}" width="1024" height="500" loading="lazy">` : '';
  const drafts = manifest.drafts.filter((d) => d.startsWith(locale));
  return `<section id="${locale}"><h2>${locale === 'de-DE' ? 'Deutsch' : 'Englisch'} (${locale})</h2>
<p class="note">${drafts.length ? `Entwurf, noch nicht freigegeben: ${esc(drafts.map((d) => d.split(' ')[1]).join(', '))}.` : 'Alle Texte freigegeben.'}</p>
${devices.join('\n')}
${feature}</section>`;
});

const date = new Date().toISOString().slice(0, 10);
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Store-Screenshots im Rahmen P2 (intern)</title>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/${ASSETS}/review.css">
</head>
<body>
<main>
<p class="internal">Intern · nur in Vorschau-Deployments · nicht indexiert</p>
<h1>Store-Screenshots im Rahmen P2 „Großschrift“</h1>
<p class="lead">Der fertige Satz für Google Play und den App Store, Deutsch und Englisch: sechs Telefon-Bilder je Größe, dazu Tablets und Feature-Grafik. Gefilmt aus der echten Web-App mit dem Haushalt „Unser Haushalt“ (Anna und Jonas, nur allgemeine Läden), gerahmt per Skript: <code>scripts/store-screenshots.sh --locale all --publish</code>, Stand ${date}. Die PNG-Dateien liegen in <code>store/screenshots/</code>. Nichts davon ist hochgeladen.</p>
<nav class="toc">${Object.keys(LOCALES).map((l) => `<a href="#${l}">${l}</a>`).join('')}</nav>
${sections.join('\n')}
</main>
</body>
</html>
`;
writeFileSync(join(repo, 'site/public', `${ASSETS}.html`), html);
writeFileSync(join(assets, 'review.css'), `@font-face{font-family:"Bricolage Grotesque";src:url("/fonts/bricolage-grotesque-latin-standard-normal.woff2") format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:Inter;src:url("/fonts/inter-latin-wght-normal.woff2") format("woff2");font-weight:100 900;font-display:swap}
*{box-sizing:border-box}
body{margin:0;background:var(--hl-color-surface);color:var(--hl-color-text);font-family:var(--hl-font-family-sans);line-height:1.5}
main{max-width:1500px;margin:0 auto;padding:32px 24px 96px}
h1,h2,h3{font-family:var(--hl-font-family-display);font-weight:800;letter-spacing:-0.03em;line-height:1.05}
h1{font-size:clamp(2rem,4vw,3.25rem);margin:8px 0 16px}
h2{font-size:2rem;margin:56px 0 12px}
h3{font-size:1.25rem;margin:32px 0 10px}
code{font-size:.9em;background:var(--hl-color-surface-sunken);padding:1px 6px;border-radius:6px}
.internal{display:inline-block;margin:0;padding:4px 14px;border:2px solid var(--hl-color-ink);border-radius:999px;background:var(--hl-color-honey);color:var(--hl-color-on-honey);font-weight:650;font-size:.875rem}
.lead{max-width:75ch;font-size:1.125rem}
.note{color:var(--hl-color-text-muted);margin-top:0}
.size{font-family:var(--hl-font-family-sans);font-weight:500;font-size:.9rem;letter-spacing:0;color:var(--hl-color-text-muted)}
.toc{display:flex;gap:8px;margin:24px 0}
.toc a{padding:6px 16px;border:2px solid var(--hl-color-ink);border-radius:999px;background:var(--hl-color-surface-raised);box-shadow:var(--hl-shadow-sticker-s);color:var(--hl-color-ink);font-weight:650;text-decoration:none}
.shots{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.shots.wide{grid-template-columns:repeat(4,minmax(0,1fr));max-width:1100px}
figure{margin:0}
figure img,.feature{display:block;width:100%;height:auto;border-radius:10px;border:2px solid var(--hl-color-ink)}
figcaption{font-size:.8rem;color:var(--hl-color-text-muted);margin-top:4px}
.feature{max-width:640px}
@media (max-width:900px){.shots{grid-template-columns:repeat(3,minmax(0,1fr))}}
`);
console.log(`review page: site/public/${ASSETS}.html (${files.length} files)`);
