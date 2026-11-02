// The review page for the proposals on the site's preview deployments (/internal/store-frames,
// noindex, left out of production by site/build.mjs). Written by build.mjs --site from the same
// proposal data as the images.
import { SHOTS } from './shots.mjs';

export const PAGE = 'internal/store-frames.html';
export const ASSETS = 'internal/store-frames';

const RESEARCH_URL = 'https://github.com/trost-systems/family-groceries/blob/job/77-store-frames-proposals/docs/store/frame-research.md';

// The research in six lines (docs/store/frame-research.md, section 3).
const FINDINGS = [
  'Bild 1 bis 3 entscheiden: Die Suche zeigt nur sie, und 85 bis 89 % der Besucher sehen Bild 5 nie (SplitMetrics).',
  'Bild 1 sagt den Nutzen in einer Zeile: gemeinsame Liste, bei allen sofort aktuell. Kein Funktionsname, kein Logo als Aufmacher.',
  'Kurze Überschriften: 3 bis 6 Wörter, höchstens 2 Zeilen auf Deutsch, groß und fett, lesbar bei 40 % Größe.',
  'Ein Gedanke pro Bild; ein echtes UI-Element herausgehoben (Callout) sagt mehr als zusätzlicher Text.',
  'Google Play: echte App in den ersten drei Bildern, 9:16 ab 1080 px, PNG ohne Alpha, Text unter 20 % der Fläche, keine Geräteabbildung, kein „beste“ oder „Nr. 1“.',
  'Panorama und Geschichte wirken erst beim Wischen auf der Store-Seite; dafür gibt es keinen öffentlichen Test. Große Überschriften haben die beste Evidenz.',
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const img = (proposal, file) => `/${ASSETS}/${proposal.id.toLowerCase()}-${file}`;
const shotAlt = (proposal, i) => `${proposal.id}, Bild ${i + 1}: ${SHOTS[proposal.order[i]].alt}`;

function phones(proposal, count = 6) {
  return [...Array(count)]
    .map((_, i) => `<img src="${img(proposal, `phone-${i + 1}.webp`)}" alt="${esc(shotAlt(proposal, i))}" width="720" height="1280" loading="lazy">`)
    .join('');
}

export function reviewPage(proposals, { commit, date }) {
  const compare = proposals
    .map((p) => `<div class="compare-col"><p class="compare-label"><a href="#${p.id.toLowerCase()}">${p.id} ${esc(p.name)}</a></p>${phones(p, 3)}</div>`)
    .join('');
  const sections = proposals
    .map(
      (p) => `<section id="${p.id.toLowerCase()}" class="proposal">
<h2>${p.id} ${esc(p.name)} <span class="direction">${esc(p.direction)}</span></h2>
<p class="rationale">${esc(p.rationale)}</p>
<div class="shots${p.id === 'P1' ? ' pano' : ''}">${phones(p)}</div>
<h3>Feature-Grafik</h3>
<img class="feature" src="${img(p, 'feature-graphic.webp')}" alt="${esc(`${p.id}, Feature-Grafik 1024 × 500`)}" width="1024" height="500" loading="lazy">
</section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Store-Screenshots: fünf Rahmen-Vorschläge (intern)</title>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/${ASSETS}/review.css">
</head>
<body>
<main>
<p class="internal">Intern · nur in Vorschau-Deployments · nicht indexiert</p>
<h1>Store-Screenshots: fünf Rahmen-Vorschläge</h1>
<p class="lead">Dieselben sechs App-Aufnahmen (Haushalt „Unser Haushalt“, Anna und Jonas) in fünf Rahmen im Hummlist-Look 6b Hex Frische. Je Vorschlag sechs Bilder für Google Play (1080 × 1920) und eine Feature-Grafik (1024 × 500). Alles per Skript gerendert: <code>node design/store-frames/build.mjs</code>, Stand ${esc(commit)} vom ${esc(date)}.</p>
<nav class="toc">${proposals.map((p) => `<a href="#${p.id.toLowerCase()}">${p.id} ${esc(p.name)}</a>`).join('')}<a href="#recherche">Recherche</a></nav>

<h2>Auf einen Blick: Bild 1 bis 3</h2>
<p class="note">So viel zeigt die Suche. Jede Spalte ein Vorschlag; die ganzen Sätze folgen unten.</p>
<div class="compare">${compare}</div>

<h2>Die Vorschläge</h2>
<table class="summary"><thead><tr><th>Vorschlag</th><th>Richtung</th><th>Warum</th></tr></thead><tbody>
${proposals.map((p) => `<tr><td><a href="#${p.id.toLowerCase()}">${p.id} ${esc(p.name)}</a></td><td>${esc(p.direction)}</td><td>${esc(p.rationale)}</td></tr>`).join('\n')}
</tbody></table>

${sections}

<section id="recherche">
<h2>Recherche in Kürze</h2>
<ul class="findings">${FINDINGS.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
<p>Mit Quellen und Wettbewerbern (AnyList, Bring!, Todoist, Things, OurGroceries, Structured, Listonic): <a href="${RESEARCH_URL}">docs/store/frame-research.md</a>.</p>
</section>
</main>
</body>
</html>
`;
}

export const REVIEW_CSS = `@font-face{font-family:"Bricolage Grotesque";src:url("/fonts/bricolage-grotesque-latin-standard-normal.woff2") format("woff2");font-weight:200 800;font-display:swap}
@font-face{font-family:Inter;src:url("/fonts/inter-latin-wght-normal.woff2") format("woff2");font-weight:100 900;font-display:swap}
*{box-sizing:border-box}
body{margin:0;background:var(--hl-color-surface);color:var(--hl-color-text);font-family:var(--hl-font-family-sans);line-height:1.5}
main{max-width:1500px;margin:0 auto;padding:32px 24px 96px}
h1,h2,h3{font-family:var(--hl-font-family-display);font-weight:800;letter-spacing:-0.03em;line-height:1.05}
h1{font-size:clamp(2rem,4vw,3.25rem);margin:8px 0 16px}
h2{font-size:2rem;margin:56px 0 12px}
h3{font-size:1.25rem;margin:24px 0 8px}
a{color:var(--hl-color-brand)}
code{font-size:.9em;background:var(--hl-color-surface-sunken);padding:1px 6px;border-radius:6px}
.internal{display:inline-block;margin:0;padding:4px 14px;border:2px solid var(--hl-color-ink);border-radius:999px;background:var(--hl-color-honey);color:var(--hl-color-on-honey);font-weight:650;font-size:.875rem}
.lead{max-width:70ch;font-size:1.125rem}
.note{color:var(--hl-color-text-muted);margin-top:0}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}
.toc a{padding:6px 16px;border:2px solid var(--hl-color-ink);border-radius:999px;background:var(--hl-color-surface-raised);box-shadow:var(--hl-shadow-sticker-s);color:var(--hl-color-ink);font-weight:650;text-decoration:none}
.compare{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
.compare-col{display:flex;flex-direction:column;gap:10px}
.compare-col img{display:block;width:100%;height:auto;border-radius:10px;border:2px solid var(--hl-color-ink)}
.compare-label{margin:0;font-family:var(--hl-font-family-display);font-weight:800;font-size:1.25rem}
.shots{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.shots.pano{gap:2px}
.shots img{display:block;width:100%;height:auto;border-radius:10px;border:2px solid var(--hl-color-ink)}
.shots.pano img{border-radius:0;border-width:2px 0}
.shots.pano img:first-child{border-left-width:2px;border-radius:10px 0 0 10px}
.shots.pano img:last-child{border-right-width:2px;border-radius:0 10px 10px 0}
.proposal{padding-top:8px}
.direction{display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 12px;border-radius:999px;background:var(--hl-color-accent-soft);color:var(--hl-color-on-accent-soft);font-family:var(--hl-font-family-sans);font-size:.875rem;font-weight:650;letter-spacing:0}
.rationale{max-width:80ch;font-size:1.0625rem}
.feature{display:block;width:100%;max-width:640px;height:auto;border-radius:10px;border:2px solid var(--hl-color-ink)}
.summary{border-collapse:collapse;width:100%;max-width:1100px}
.summary th,.summary td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--hl-color-divider)}
.findings{max-width:80ch;padding-left:1.2em}
.findings li{margin:6px 0}
@media (max-width:900px){.shots,.compare{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
