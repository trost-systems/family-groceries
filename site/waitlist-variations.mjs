// The waitlist landing variations V1-V5 (job 83): an internal preview under /internal/waitlist,
// one page per variant and language plus an index, from content/internal/waitlist-variations.yml.
// Each variant is its list of blocks in page order; BLOCKS renders each type. The sign-up form is a
// mock (public/internal/waitlist.js): it validates and shows the thank-you states, and sends
// nothing. The form's markup and classes are job 82's (public/internal/waitlist.css is its
// waitlist.css), so the winning variant ports back onto the real form.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { CopyError, mediaFor, picture } from './landing.mjs';

export const BASE = '/internal/waitlist';
const LOCALES = ['de', 'en'];
const STATES = ['page', 'inbox', 'confirmed', 'known'];
const ANCHOR = { de: 'warteliste', en: 'waitlist' };
const LEGAL_LINKS = {
  de: [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz']],
  en: [['Imprint', '/en/imprint'], ['Privacy', '/en/privacy']],
};

export const route = (variant, locale) => `${BASE}/${variant}/${locale}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Copy text: escaped, with the source's [LEGAL: …] placeholders marked so they stay visible.
const t = (s) => esc(s).replace(/\[LEGAL:[^\]]*\]/g, (m) => `<mark class="wv-legal">${m}</mark>`);

// The source's reviewer markers ([LEGAL CHECK], [PM CHECK: …], …): tags beside the copy they belong to.
const notes = (list = []) =>
  list.length === 0 ? '' : `<p class="rv-notes">${list.map((n) => `<span class="rv-note">${esc(n)}</span>`).join(' ')}</p>`;

const ICONS = {
  check: 'M9.55 18 3.85 12.3l1.43-1.43 4.27 4.28 9.17-9.18 1.43 1.43Z',
  drag: 'M9 20q-.82 0-1.41-.59T7 18t.59-1.41T9 16t1.41.59T11 18t-.59 1.41T9 20m6 0q-.82 0-1.41-.59T13 18t.59-1.41T15 16t1.41.59T17 18t-.59 1.41T15 20m-6-6q-.82 0-1.41-.59T7 12t.59-1.41T9 10t1.41.59T11 12t-.59 1.41T9 14m6 0q-.82 0-1.41-.59T13 12t.59-1.41T15 10t1.41.59T17 12t-.59 1.41T15 14M9 8q-.82 0-1.41-.59T7 6t.59-1.41T9 4t1.41.59T11 6t-.59 1.41T9 8m6 0q-.82 0-1.41-.59T13 6t.59-1.41T15 4t1.41.59T17 6t-.59 1.41T15 8',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICONS[name]}"/></svg>`;
const tick = `<span class="tick hxp" aria-hidden="true">${icon('check')}</span>`;

// Store categories of the V4 sort animation: the landing's stores scene, in their final order.
// Frozen starts on top and is dragged to the bottom; variations.css places each row by its index.
const SORT = {
  de: [['🥕', 'Obst & Gemüse'], ['🥖', 'Brot & Backwaren'], ['🥛', 'Kühlregal'], ['🥫', 'Vorrat & Konserven'], ['🧊', 'Tiefkühl']],
  en: [['🥕', 'Fruit & veg'], ['🥖', 'Bread & bakery'], ['🥛', 'Chilled'], ['🥫', 'Pantry'], ['🧊', 'Frozen']],
};

function sortVisual(locale, alt) {
  const rows = SORT[locale];
  const last = rows.length - 1;
  const chips = rows
    .map(([emoji, name], to) => `<li class="hx wv-sort-chip${to === last ? ' is-dragged' : ''}"><span class="emo">${emoji}</span>${esc(name)}<span class="grip">${icon('drag')}</span></li>`)
    .join('');
  const slots = rows.map((_, i) => `<li><span class="hxp step">${i + 1}</span></li>`).join('');
  return `<figure class="wv-sort" role="img" aria-label="${esc(alt)}" data-sort><ol class="wv-sort-slots" aria-hidden="true">${slots}</ol><ul class="wv-sort-chips" aria-hidden="true">${chips}</ul></figure>`;
}

function heroVisual(name, ctx) {
  if (!name) return '';
  const { locale, publicDir, alt } = ctx;
  if (name === 'sort') return `<div class="hero-visual wv-visual--sort">${sortVisual(locale, alt.sort)}</div>`;
  if (name === 'hero') return `<div class="hero-visual">${picture(mediaFor(publicDir, 'hero', locale, { shape: 'hero' }), alt.hero)}</div>`;
  return `<div class="hero-visual wv-visual--card"><figure class="media-frame">${picture(mediaFor(publicDir, name, locale, { shape: 'card' }), alt[name])}</figure></div>`;
}

function form(block, ctx) {
  const { shared, locale } = ctx;
  const f = shared.form;
  const spec = block.form;
  const heading = spec.heading ? `<h2 class="title" id="wl-title">${t(spec.heading)}</h2>` : '';
  const intro = spec.intro ? `<p class="wl-intro">${t(spec.intro)}</p>` : '';
  const labelled = spec.heading ? 'aria-labelledby="wl-title"' : 'aria-labelledby="hero-title"';
  const msg = (key) => `data-msg-${key}="${esc(f[key])}"`;
  return `<section class="wl-card" id="${ANCHOR[locale]}" ${labelled} data-wv-form ${msg('email-missing')} ${msg('email-invalid')} ${msg('platform-missing')}>
<form class="wl-form" novalidate data-when="page known sending">
${heading}
${intro}
${notes(spec.notes)}
<div class="wl-field">
<label for="wl-email">${t(f.email)}</label>
<input class="wl-input" id="wl-email" name="email" type="email" required autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254" placeholder="${esc(f['email-placeholder'])}" aria-describedby="wl-email-hint">
<p class="wl-hint" id="wl-email-hint">${t(f['email-hint'])}</p>
<p class="wl-error" id="wl-email-error" hidden></p>
</div>
<fieldset class="wl-field wl-platform">
<legend>${t(f.platform)}</legend>
<div class="wl-options">
<label class="wl-option"><input type="radio" name="platform" value="ios" required><span class="wl-mark"></span><span>${t(f.ios)}</span></label>
<label class="wl-option"><input type="radio" name="platform" value="android" required><span class="wl-mark"></span><span>${t(f.android)}</span></label>
</div>
<p class="wl-error" id="wl-platform-error" hidden></p>
</fieldset>
<p class="wl-status" role="alert"><span data-when="known" hidden>${t(f.known)}</span></p>
<button class="hex wl-submit" type="submit"><span class="face"><span data-when="page known">${t(spec.button ?? f.button)}</span><span data-when="sending" hidden>${t(f.sending)}</span></span></button>
<p class="wl-small">${t(spec.below ?? f.below)}</p>
<p class="wl-consent">${t(f.consent)}</p>
</form>
<div class="wl-done" data-when="inbox" hidden tabindex="-1">
${tick}
<h2 class="title">${t(shared.inbox.title)}</h2>
<p>${t(shared.inbox.body).replace(/\[E-?MAIL\]/, `<strong data-email>${esc(f['email-placeholder'])}</strong>`)}</p>
<p class="wl-small">${t(shared.inbox.small)}</p>
<button class="rv-mock" type="button" data-goto="confirmed">${esc(shared.mock)}</button>
</div>
</section>`;
}

function hero(block, ctx) {
  const small = block.small ? `<p class="audience">${t(block.small)}</p>` : '';
  const checks = block.checks
    ? `<ul class="wv-checks">${block.checks.map((c) => `<li>${tick}<span>${t(c)}</span></li>`).join('')}</ul>`
    : '';
  const mcp = block.mcp ? `<div class="wv-hero-mcp"><p>${t(block.mcp)}</p>${notes(block['mcp-notes'])}</div>` : '';
  return `<section class="hero${block.minimal ? ' wv-hero--minimal' : ''}" aria-labelledby="hero-title">
<div class="wrap block block--cobalt hero-block">
<div class="hero-copy">
<p class="chip hx"><span class="dot hxp" aria-hidden="true">${icon('check')}</span><span>${t(block.badge)}</span></p>
<h1 class="display" id="hero-title">${t(block.title)}</h1>
<p class="lead">${t(block.subline)}</p>
${small}${checks}${notes(block.notes)}
</div>
${form(block, ctx)}
${mcp}${heroVisual(block.visual, ctx)}
</div>
</section>`;
}

const pointItems = (items) =>
  items.map((p) => `<li class="wv-point">${tick}<p><strong>${t(p.title)}</strong> ${t(p.body)}</p></li>`).join('\n');

function points(block) {
  const head = block.heading ? `<h2 class="headline" id="wv-points">${t(block.heading)}</h2>` : '';
  return `<section class="section wv-points"${block.heading ? ' aria-labelledby="wv-points"' : ''}>
<div class="wrap">
${head}
<ul class="wv-point-list">
${pointItems(block.items)}
</ul>
</div>
</section>`;
}

function extra(block) {
  return `<section class="section" aria-labelledby="wv-extra">
<div class="wrap">
<div class="block block--mist wv-extra">
<h2 class="title" id="wv-extra">${t(block.heading)}</h2>
<p>${t(block.body)}</p>
${notes(block.notes)}
</div>
</div>
</section>`;
}

function note(block) {
  return `<section class="section">
<div class="wrap">
<figure class="wv-note">
<blockquote><p>${t(block.text)}</p></blockquote>
<figcaption>${t(block.signature)}</figcaption>
</figure>
${notes(block.notes)}
</div>
</section>`;
}

function chat(block) {
  const items = block.items
    .map(
      (c) => `<li class="wv-exchange">
<p class="wv-ask">${t(c.ask)}</p>
<p class="wv-result"><span class="wv-result-head"><span class="mark" aria-hidden="true"></span>Hummlist</span><span>${t(c.result)}</span></p>
</li>`,
    )
    .join('\n');
  return `<section class="section" aria-labelledby="wv-chat">
<div class="wrap block block--mist wv-chat">
<h2 class="headline" id="wv-chat">${t(block.heading)}</h2>
<ol class="wv-thread">
${items}
</ol>
<p class="wv-below">${t(block.below)}</p>
${notes(block.notes)}
</div>
</section>`;
}

function steps(block, ctx) {
  const items = block.items
    .map((s, i) => `<li><span class="hxp step" aria-hidden="true">${i + 1}</span><p><strong>${t(s.title)}</strong> ${t(s.body)}</p></li>`)
    .join('\n');
  const visual = block.visual
    ? `<figure class="media-frame">${picture(mediaFor(ctx.publicDir, block.visual, ctx.locale, { shape: 'card' }), ctx.alt[block.visual])}</figure>`
    : '';
  return `<section class="section" aria-labelledby="wv-steps">
<div class="wrap block block--honey wv-steps${visual ? ' wv-steps--visual' : ''}">
<div class="wv-steps-copy">
<h2 class="headline" id="wv-steps">${t(block.heading)}</h2>
<ol class="wv-step-list">
${items}
</ol>
${notes(block.notes)}
</div>
${visual}
</div>
</section>`;
}

function line(block) {
  return `<section class="section">
<div class="wrap">
<div class="wv-line wv-line--${block.style}">${block.style === 'reassure' ? tick : ''}<p>${t(block.text)}</p></div>
${notes(block.notes)}
</div>
</section>`;
}

function faq(block, ctx) {
  const items = block.items.flatMap((item) => (item.install ? ctx.shared.install : [item]));
  const list = items
    .map(
      (item) => `<details class="faq-item">
<summary>${t(item.q)}</summary>
<p>${t(item.a)}</p>
${notes(item.notes)}
</details>`,
    )
    .join('\n');
  if (block.collapsed) {
    return `<section class="section wv-questions">
<div class="wrap">
<details class="wv-more">
<summary>${t(block.collapsed)}</summary>
<div class="faq">
${list}
</div>
</details>
</div>
</section>`;
  }
  return `<section class="section faq-section" aria-labelledby="wv-faq">
<div class="wrap">
<div class="section-head"><h2 class="headline" id="wv-faq">${t(ctx.shared.faq)}</h2></div>
<div class="faq">
${list}
</div>
</div>
</section>`;
}

function closing(block, ctx) {
  return `<section class="section" aria-labelledby="wv-closing">
<div class="wrap block block--honey cta">
<h2 class="headline" id="wv-closing">${t(block.line)}</h2>
<div class="cta-actions"><a class="hex hex--tomato" href="#${ANCHOR[ctx.locale]}"><span class="face">${t(block.button)}</span></a></div>
${notes(block.notes)}
</div>
</section>`;
}

const BLOCKS = { hero, points, extra, note, chat, steps, line, faq, closing };

// What each block type needs; checked when the file is read, so a typo fails the build.
const REQUIRED = {
  hero: ['badge', 'title', 'subline', 'form'],
  points: ['items'],
  extra: ['heading', 'body'],
  note: ['text', 'signature'],
  chat: ['heading', 'items', 'below'],
  steps: ['heading', 'items'],
  line: ['style', 'text'],
  faq: ['items'],
  closing: ['line', 'button'],
};

export function parseVariations(text, file) {
  const fail = (reason) => {
    throw new CopyError(`${file}: ${reason}`);
  };
  const data = yaml.safeLoad(text);
  if (!data?.shared || !data?.variants) fail('needs "shared" and "variants"');
  for (const locale of LOCALES) if (!data.shared[locale]) fail(`shared.${locale} is missing`);
  for (const [id, variant] of Object.entries(data.variants)) {
    if (!/^v\d+$/.test(id)) fail(`variant id "${id}" must look like v1`);
    for (const field of ['name', 'angle', 'order']) if (typeof variant[field] !== 'string') fail(`${id}.${field} is missing`);
    const types = LOCALES.map((locale) => {
      const page = variant[locale];
      if (!page?.meta?.title || !page?.meta?.description || !page?.thanks || !Array.isArray(page?.blocks)) {
        fail(`${id}.${locale} needs meta.title, meta.description, thanks and blocks`);
      }
      if (page.blocks[0]?.type !== 'hero') fail(`${id}.${locale}: the first block must be the hero (it holds the form)`);
      for (const [i, block] of page.blocks.entries()) {
        if (!BLOCKS[block.type]) fail(`${id}.${locale}.blocks[${i}]: unknown type "${block.type}"`);
        const missing = REQUIRED[block.type].filter((f) => block[f] === undefined);
        if (missing.length > 0) fail(`${id}.${locale}.blocks[${i}] (${block.type}) is missing ${missing.join(', ')}`);
      }
      return page.blocks.map((b) => b.type).join(' ');
    });
    if (types[0] !== types[1]) fail(`${id}: de and en must have the same blocks in the same order (${types.join(' | ')})`);
  }
  return data;
}

export function readVariations(contentDir) {
  return parseVariations(readFileSync(join(contentDir, 'internal/waitlist-variations.yml'), 'utf8'), 'content/internal/waitlist-variations.yml');
}

function reviewBar(id, locale, ids, shared) {
  const link = (href, label, current) => `<a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="rv-bar" aria-label="${esc(shared.review)}">
<p><strong>${esc(shared.review)}</strong> ${esc(shared.variant)} ${ids.map((v) => link(route(v, locale), v.toUpperCase(), v === id)).join(' ')} · ${LOCALES.map((l) => link(route(id, l), l.toUpperCase(), l === locale)).join(' ')} · ${esc(shared.state)} ${STATES.map((s) => `<a href="${route(id, locale)}${s === 'page' ? '' : `?s=${s}`}" data-state-link="${s}">${esc(shared.states[s])}</a>`).join(' ')} · ${link(BASE, esc(shared.overview), false)}</p>
</nav>`;
}

function confirmed(page, shared, self) {
  return `<section class="section wv-confirmed" data-when="confirmed" hidden>
<div class="wrap">
<div class="wl-page" tabindex="-1">
${tick}
<h2 class="headline">${t(shared.confirmed.title)}</h2>
<p>${t(shared.confirmed.body)}</p>
<p>${t(page.thanks)}</p>
${notes(page['thanks-notes'])}
<p><a class="link-strong" href="${self}">${t(shared.confirmed.back)}</a></p>
</div>
</div>
</section>`;
}

const HEAD = (head, script = true) => `${head}<link rel="stylesheet" href="/landing.css">
<link rel="stylesheet" href="/internal/waitlist.css">
<link rel="stylesheet" href="/internal/variations.css">
${script ? '<script src="/internal/waitlist.js" defer></script>\n' : ''}`;

function variantPage(id, locale, { data, head, publicDir, alt }) {
  const variant = data.variants[id];
  const page = variant[locale];
  const shared = data.shared[locale];
  const self = route(id, locale);
  const ctx = { locale, shared, publicDir, alt: alt[locale] };
  const ids = Object.keys(data.variants);
  const cta =
    variant['header-cta'] === false
      ? ''
      : `<a class="hex hex--small header-cta" href="#${ANCHOR[locale]}" data-when="page sending known inbox"><span class="face">${esc(shared['header-cta'])}</span></a>`;
  const body = page.blocks.map((block) => BLOCKS[block.type](block, ctx).replace('<section', `<section data-block="${block.type}"`)).join('\n');
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(page.meta.title)}</title>
<meta name="description" content="${esc(page.meta.description)}">
${HEAD(head)}</head>
<body class="landing wv wv--${id}">
<a class="skip" href="#inhalt">${esc(shared.skip)}</a>
${reviewBar(id, locale, ids, shared)}
<header class="site-header">
<div class="wrap">
<a class="brand" href="${self}" aria-label="Hummlist"><span class="mark" aria-hidden="true"></span>Hummlist</a>
${cta}
</div>
</header>
<main id="inhalt" data-state="page" data-wv>
<div class="wv-blocks" data-when="page sending known inbox">
${body}
</div>
${confirmed(page, shared, self)}
</main>
<footer class="site-footer">
<div class="wrap">
<a class="brand" href="${self}" aria-label="Hummlist"><span class="mark" aria-hidden="true"></span>Hummlist</a>
<nav class="footer-legal" aria-label="${locale === 'de' ? 'Rechtliches' : 'Legal'}"><ul>${LEGAL_LINKS[locale].map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul></nav>
</div>
</footer>
</body>
</html>
`;
}

function indexPage({ data, head }) {
  const rows = Object.entries(data.variants)
    .map(([id, v]) => {
      const meta = v['meta-notes'] ? ` ${notes(v['meta-notes'])}` : '';
      const states = STATES.slice(1)
        .map((s) => `<a href="${route(id, 'de')}?s=${s}">${esc(data.shared.de.states[s])}</a>`)
        .join(' · ');
      return `<li class="wv-index-item">
<h2>${id.toUpperCase()} · ${esc(v.name)}</h2>
<p><strong>Winkel:</strong> ${esc(v.angle)}</p>
<p><strong>Reihenfolge:</strong> ${esc(v.order)}</p>
<p><strong>Meta:</strong> ${esc(v.de.meta.title)} / ${esc(v.en.meta.title)}</p>${meta}
<p class="wv-index-links"><a class="hex hex--small" href="${route(id, 'de')}"><span class="face">${id.toUpperCase()} Deutsch</span></a> <a class="hex hex--small" href="${route(id, 'en')}"><span class="face">${id.toUpperCase()} English</span></a></p>
<p>Zustände (DE): ${states}</p>
</li>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Warteliste: Varianten V1–V5 (interne Vorschau)</title>
${HEAD(head, false)}</head>
<body class="wv-index">
<main id="inhalt" class="wrap prose">
<h1>Warteliste: Varianten V1–V5</h1>
<p>Interne Vorschau für Peter und Hummlist Launch, nicht öffentlich und nicht indexiert. Jede Variante gibt es auf Deutsch und Englisch. Das Formular ist ein Mock: Es prüft die Eingaben und zeigt die Danke-Zustände, schickt aber nichts ab. Die grauen Marken ([LEGAL CHECK], [PM CHECK: …], [PETER CHECK: …]) sind Prüfhinweise aus dem Copy-Entwurf, die gelben [LEGAL: …]-Platzhalter stehen so im Entwurf.</p>
<ul class="wv-index-list">
${rows}
</ul>
</main>
</body>
</html>
`;
}

// [{ route, html }] for the index and every variant in both languages. `alt` holds the landing's
// image descriptions per locale, so the posters keep their approved alt texts.
export function variationPages({ data, head, publicDir, alt }) {
  const pages = [{ route: BASE, html: indexPage({ data, head }) }];
  for (const id of Object.keys(data.variants)) {
    for (const locale of LOCALES) pages.push({ route: route(id, locale), html: variantPage(id, locale, { data, head, publicDir, alt }) });
  }
  return pages;
}
