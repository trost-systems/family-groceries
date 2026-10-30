import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { parse } from 'node-html-parser';

const SITE_DIR = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(SITE_DIR, 'public');

export const LOCALES = {
  de: {
    name: 'Deutsch',
    guidesBase: '/de/anleitungen',
    ogLocale: 'de_DE',
    footer: {
      imprint: { label: 'Impressum', href: '/impressum' },
      privacy: { label: 'Datenschutz', href: '/datenschutz' },
      support: { label: 'Hilfe', href: '/support' },
    },
    ui: { updated: 'Aktualisiert', languageNav: 'Sprache', footerNav: 'Rechtliches', draft: 'ENTWURF: Freigabe durch Peter' },
  },
  en: {
    name: 'English',
    guidesBase: '/en/guides',
    ogLocale: 'en_US',
    footer: {
      imprint: { label: 'Imprint', href: '/en/imprint' },
      privacy: { label: 'Privacy', href: '/en/privacy' },
      support: { label: 'Support', href: '/en/support' },
    },
    ui: { updated: 'Updated', languageNav: 'Language', footerNav: 'Legal', draft: "DRAFT: pending Peter's approval" },
  },
};

const SITE_NAME = 'Hummlist';

// A footer link to a page that isn't built yet fails the build, so each waits for its flag.
const FOOTER_LINKS = [
  { key: 'imprint', shown: () => true },
  { key: 'privacy', shown: (config) => config.privacyPublished },
  { key: 'support', shown: (config) => config.supportPublished },
];

// `draft: true` in the frontmatter: built with a banner and noindex in preview and local builds,
// left out of Vercel production builds, so the path answers 404 there as before.
const isProduction = (env) => env.VERCEL_ENV === 'production';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: true });

// `## Heading {#id}` gives the heading a stable anchor, e.g. /datenschutz#rechte for the stores.
const HEADING_ID = /\s*\{#([a-z0-9-]+)\}$/;
md.core.ruler.push('heading_id', (state) => {
  state.tokens.forEach((token, i) => {
    if (token.type !== 'heading_open') return;
    const inline = state.tokens[i + 1];
    const last = inline.children.at(-1);
    const match = last?.type === 'text' && HEADING_ID.exec(last.content);
    if (!match) return;
    token.attrSet('id', match[1]);
    last.content = last.content.slice(0, match.index);
  });
});

function markdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f));
}

export const KINDS = {
  guide: {
    fields: ['title', 'description', 'slug', 'locale', 'translation_key', 'updated'],
    ogType: 'article',
    files: (contentDir) => {
      const root = join(contentDir, 'guides');
      if (!existsSync(root)) return [];
      return readdirSync(root).flatMap((folder) =>
        markdownFiles(join(root, folder)).map((file) => ({
          file,
          expect: { locale: folder, slug: file.slice(file.lastIndexOf('/') + 1, -3) },
        })),
      );
    },
    route: (fm) => `${LOCALES[fm.locale].guidesBase}/${fm.slug}`,
    group: (fm) => `guide:${fm.translation_key}`,
  },
  page: {
    fields: ['title', 'description', 'locale', 'path', 'translation_key', 'updated'],
    ogType: 'website',
    files: (contentDir) => markdownFiles(join(contentDir, 'legal')).map((file) => ({ file, expect: {} })),
    route: (fm) => fm.path,
    group: (fm) => `page:${fm.translation_key}`,
  },
  index: {
    fields: ['title', 'description', 'locale'],
    ogType: 'website',
    files: (contentDir) =>
      markdownFiles(join(contentDir, 'indexes')).map((file) => ({
        file,
        expect: { locale: file.slice(file.lastIndexOf('/') + 1, -3) },
      })),
    route: (fm) => LOCALES[fm.locale].guidesBase,
    group: () => 'index',
  },
};

class BuildError extends Error {}

function fail(file, reason) {
  throw new BuildError(`${file}: ${reason}`);
}

function normalizeDate(value, file) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return value;
  fail(file, `frontmatter field "updated" must be a date (YYYY-MM-DD), got ${JSON.stringify(value)}`);
}

function loadPage(kindName, { file, expect }, contentDir) {
  const kind = KINDS[kindName];
  const name = relative(contentDir, file);
  const { data, content } = matter(readFileSync(file, 'utf8'));
  for (const field of kind.fields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') fail(name, `missing required frontmatter field "${field}"`);
  }
  const fm = { ...data };
  if (fm.updated !== undefined) fm.updated = normalizeDate(fm.updated, name);
  for (const field of kind.fields.filter((f) => f !== 'updated')) {
    if (typeof fm[field] !== 'string') fail(name, `frontmatter field "${field}" must be a string`);
  }
  if (!LOCALES[fm.locale]) fail(name, `frontmatter field "locale" must be one of ${Object.keys(LOCALES).join(', ')}, got "${fm.locale}"`);
  for (const [field, expected] of Object.entries(expect)) {
    if (fm[field] !== expected) fail(name, `frontmatter field "${field}" is "${fm[field]}" but the file location requires "${expected}"`);
  }
  if (fm.draft !== undefined && typeof fm.draft !== 'boolean') fail(name, `frontmatter field "draft" must be true or false, got ${JSON.stringify(fm.draft)}`);
  if (kindName === 'page' && !/^\/[a-z0-9/-]*[a-z0-9]$/.test(fm.path)) fail(name, `frontmatter field "path" must look like /some/path, got "${fm.path}"`);
  return {
    kind: kindName,
    file: name,
    route: kind.route(fm),
    group: kind.group(fm),
    ogType: kind.ogType,
    locale: fm.locale,
    title: fm.title,
    description: fm.description,
    updated: fm.updated,
    draft: fm.draft === true,
    body: md.render(content),
  };
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function formatDate(iso, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
}

function mainContent(page, guidesByLocale) {
  if (page.kind === 'index') {
    const items = guidesByLocale[page.locale]
      .map((g) => `<li><a href="${g.route}">${escapeHtml(g.title)}</a><p>${escapeHtml(g.description)}</p></li>`)
      .join('\n');
    return `<h1>${escapeHtml(page.title)}</h1>\n${page.body}<ul class="guide-list">\n${items}\n</ul>`;
  }
  if (page.kind === 'guide') {
    const label = LOCALES[page.locale].ui.updated;
    return `${page.body}<p class="updated">${label}: <time datetime="${page.updated}">${formatDate(page.updated, page.locale)}</time></p>`;
  }
  return page.body;
}

function renderPage(page, { config, groups, guidesByLocale }) {
  const { siteUrl, defaultLocale } = config;
  const locale = LOCALES[page.locale];
  const versions = groups.get(page.group);
  const url = siteUrl + page.route;
  const xDefault = versions[defaultLocale] ?? page;
  const alternates = Object.values(versions)
    .map((v) => `<link rel="alternate" hreflang="${v.locale}" href="${siteUrl}${v.route}">`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${siteUrl}${xDefault.route}">`)
    .join('\n');
  const switches = Object.keys(LOCALES)
    .filter((code) => code !== page.locale)
    .map((code) => {
      const href = versions[code]?.route ?? LOCALES[code].guidesBase;
      return `<a href="${href}" lang="${code}" hreflang="${code}">${LOCALES[code].name}</a>`;
    })
    .join(' ');
  const footer = FOOTER_LINKS.filter((link) => link.shown(config))
    .map(({ key }) => `<li><a href="${locale.footer[key].href}">${locale.footer[key].label}</a></li>`)
    .join('');
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const draft = page.draft ? escapeHtml(locale.ui.draft) : null;
  return `<!doctype html>
<html lang="${page.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${draft ? `<!-- ${locale.ui.draft} -->\n<meta name="robots" content="noindex">\n` : ''}<title>${title} | ${SITE_NAME}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
${alternates}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="${page.ogType}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${locale.ogLocale}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
${draft ? `<p class="draft-banner" role="note"><strong>${draft}</strong></p>\n` : ''}<header class="site-header">
<a class="site-name" href="${locale.guidesBase}">${SITE_NAME}</a>
<nav aria-label="${locale.ui.languageNav}">${switches}</nav>
</header>
<main>
${mainContent(page, guidesByLocale)}
</main>
<footer class="site-footer">
<nav aria-label="${locale.ui.footerNav}"><ul>${footer}</ul></nav>
</footer>
</body>
</html>
`;
}

function standalonePage({ lang, title, head = '', body }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${head}<link rel="icon" href="/favicon.png" type="image/png">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function indexLinks() {
  return Object.entries(LOCALES)
    .map(([code, l]) => `<li><a href="${l.guidesBase}" lang="${code}" hreflang="${code}">${l.name}</a></li>`)
    .join('\n');
}

function rootPage(config) {
  const target = LOCALES[config.defaultLocale].guidesBase;
  return standalonePage({
    lang: config.defaultLocale,
    title: SITE_NAME,
    head: `<meta http-equiv="refresh" content="0; url=${target}">\n`,
    body: `<h1>${SITE_NAME}</h1>\n<ul class="guide-list">\n${indexLinks()}\n</ul>`,
  });
}

function notFoundPage(config) {
  return standalonePage({
    lang: config.defaultLocale,
    title: `Seite nicht gefunden | Page not found | ${SITE_NAME}`,
    body: `<h1>Seite nicht gefunden <span lang="en">/ Page not found</span></h1>
<p>Diese Seite gibt es nicht. <span lang="en">This page does not exist.</span></p>
<ul class="guide-list">\n${indexLinks()}\n</ul>`,
  });
}

const routeFile = (route) => (route === '/' ? 'index.html' : `${route.slice(1)}.html`);

function htmlFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith('.html'))
    .map((f) => join(dir, f));
}

const EXTERNAL = /^(https?:)?\/\//i;

function checkHtml(file, html, outDir, siteUrl) {
  const name = relative(outDir, file);
  const doc = parse(html);
  const h1s = doc.querySelectorAll('h1').length;
  if (h1s !== 1) fail(name, `expected exactly one <h1>, found ${h1s}`);
  let previous = 0;
  for (const h of doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const level = Number(h.tagName[1]);
    if (level > previous + 1) fail(name, `heading level skipped: <h${level}> "${h.text.trim()}" follows <h${previous}>`);
    previous = level;
  }
  for (const img of doc.querySelectorAll('img')) {
    if (!img.getAttribute('alt')?.trim()) fail(name, `<img src="${img.getAttribute('src')}"> has no alt text`);
  }
  for (const tag of ['script', 'iframe', 'object', 'embed']) {
    if (doc.querySelector(tag)) fail(name, `<${tag}> is not allowed`);
  }
  const resources = [
    ...doc.querySelectorAll('link').filter((l) => !['canonical', 'alternate'].includes(l.getAttribute('rel'))).map((l) => l.getAttribute('href')),
    ...doc.querySelectorAll('img, source').flatMap((el) => [el.getAttribute('src'), ...(el.getAttribute('srcset') ?? '').split(',').map((s) => s.trim().split(/\s+/)[0])]),
  ].filter(Boolean);
  for (const url of resources) {
    if (EXTERNAL.test(url)) fail(name, `external resource ${url} is not allowed`);
  }
  const hrefs = doc.querySelectorAll('a[href], link[href]').map((el) => el.getAttribute('href'));
  for (const href of hrefs) {
    const local = href.startsWith(siteUrl + '/') ? href.slice(siteUrl.length) : href;
    if (!local.startsWith('/') || local.startsWith('//')) continue;
    const path = decodeURIComponent(local.split(/[#?]/)[0]);
    const exists =
      path === '/' ||
      (!path.endsWith('/') && (existsSync(join(outDir, `${path}.html`)) || (existsSync(join(outDir, path)) && statSync(join(outDir, path)).isFile())));
    if (!exists || path.endsWith('.html')) fail(name, `broken internal link ${href}`);
  }
}

export function readConfig(siteDir = SITE_DIR) {
  return JSON.parse(readFileSync(join(siteDir, 'config.json'), 'utf8'));
}

export function build({ contentDir = join(SITE_DIR, 'content'), outDir = join(SITE_DIR, 'dist'), env = {}, config = readConfig() } = {}) {
  const pages = Object.keys(KINDS)
    .flatMap((kind) => KINDS[kind].files(contentDir).map((entry) => loadPage(kind, entry, contentDir)))
    .filter((page) => !(page.draft && isProduction(env)));

  const byRoute = new Map([['/', { file: '(root page)' }], ['/404', { file: '(404 page)' }]]);
  for (const page of pages) {
    const other = byRoute.get(page.route);
    if (other) fail(page.file, `route ${page.route} is also produced by ${other.file}`);
    byRoute.set(page.route, page);
  }

  const groups = new Map();
  for (const page of pages) {
    const versions = groups.get(page.group) ?? {};
    if (versions[page.locale]) fail(page.file, `translation_key also used by ${versions[page.locale].file} for locale ${page.locale}`);
    groups.set(page.group, { ...versions, [page.locale]: page });
  }

  const guidesByLocale = Object.fromEntries(
    Object.keys(LOCALES).map((code) => [
      code,
      pages.filter((p) => p.kind === 'guide' && p.locale === code).sort((a, b) => a.title.localeCompare(b.title, code)),
    ]),
  );

  const rendered = pages.map((page) => ({ page, html: renderPage(page, { config, groups, guidesByLocale }) }));

  const warnings = [];
  const placeholders = rendered.flatMap(({ page, html }) =>
    [...new Set(html.match(/\[PETER:[^\]]*\]?/g) ?? [])].map((p) => `${page.file}: ${p}`),
  );
  if (placeholders.length > 0) {
    const list = placeholders.join('\n  ');
    if (isProduction(env)) throw new BuildError(`placeholders left in published pages:\n  ${list}`);
    warnings.push(`placeholders left in published pages (production builds fail on these):\n  ${list}`);
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(PUBLIC_DIR, outDir, { recursive: true });
  const write = (route, html) => {
    const file = join(outDir, routeFile(route));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  for (const { page, html } of rendered) write(page.route, html);
  write('/', rootPage(config));
  write('/404', notFoundPage(config));

  for (const file of htmlFiles(outDir)) checkHtml(file, readFileSync(file, 'utf8'), outDir, config.siteUrl);

  return { routes: ['/', ...pages.map((p) => p.route)], warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { routes, warnings } = build({ env: { VERCEL_ENV: process.env.VERCEL_ENV } });
    for (const w of warnings) console.warn(`warning: ${w}`);
    console.log(`built ${routes.length} pages into dist/`);
  } catch (error) {
    if (!(error instanceof BuildError)) throw error;
    console.error(`build failed: ${error.message}`);
    process.exit(1);
  }
}
