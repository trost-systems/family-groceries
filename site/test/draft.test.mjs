import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:http';
import { buildSite, htmlRoutes, legal, alternates, meta, CONTENT_DIR } from './helpers.mjs';
import { startPreview } from '../scripts/preview.mjs';

const PROD = { VERCEL_ENV: 'production' };

// The privacy policy (33a) still has Peter's placeholders, which fail any production build; these
// tests are about drafts, so they build production with every placeholder filled, plus `files`.
const filled = (files = {}) => ({
  ...Object.fromEntries(
    readdirSync(CONTENT_DIR, { recursive: true })
      .filter((f) => f.endsWith('.md'))
      .map((f) => [f, readFileSync(join(CONTENT_DIR, f), 'utf8').replace(/\[PETER:[^\]]*\]/g, 'filled')]),
  ),
  ...files,
});
const SUPPORT = ['/support', '/en/support'];
const BANNER = { '/support': 'ENTWURF: Freigabe durch Peter', '/en/support': "DRAFT: pending Peter's approval" };

const get = (base, path) =>
  new Promise((resolve, reject) => {
    request(base + path, (res) => {
      let body = '';
      res.setEncoding('utf8').on('data', (c) => (body += c)).on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject).end();
  });

async function serve(outDir, paths) {
  const server = await startPreview({ dir: outDir, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    return Object.fromEntries(await Promise.all(paths.map(async (p) => [p, await get(base, p)])));
  } finally {
    server.close();
  }
}

const published = (text) => text.replace(/^draft: true\n/m, '');

test('the support pages are drafts until Peter approves them', () => {
  for (const file of ['legal/support.md', 'legal/support-en.md']) {
    assert.match(readFileSync(join(CONTENT_DIR, file), 'utf8'), /^draft: true$/m, `${file} is still a draft`);
  }
});

test('a preview build has the draft pages with banner, comment and noindex', async () => {
  for (const env of [{}, { VERCEL_ENV: 'preview' }]) {
    const { outDir, page } = buildSite({ env });
    for (const route of SUPPORT) {
      assert.ok(htmlRoutes(outDir).includes(route), `${route} built for ${JSON.stringify(env)}`);
      const html = readFileSync(join(outDir, `${route.slice(1)}.html`), 'utf8');
      assert.ok(html.includes(`<!-- ${BANNER[route]} -->`), `${route} has the draft comment`);
      const doc = page(route);
      assert.equal(doc.querySelector('.draft-banner').text, BANNER[route], route);
      assert.equal(doc.querySelector('.draft-banner').getAttribute('role'), 'note');
      assert.equal(meta(doc, 'robots'), 'noindex', route);
    }
    const res = await serve(outDir, SUPPORT);
    for (const route of SUPPORT) {
      assert.equal(res[route].status, 200, route);
      assert.equal(res[route].headers['x-robots-tag'], 'noindex', route);
    }
  }
});

test('the German and English support pages link each other', () => {
  const { page } = buildSite();
  assert.equal(page('/support').querySelector('html').getAttribute('lang'), 'de');
  assert.equal(page('/en/support').querySelector('html').getAttribute('lang'), 'en');
  assert.equal(page('/support').querySelector('header nav a').getAttribute('href'), '/en/support');
  assert.equal(page('/en/support').querySelector('header nav a').getAttribute('href'), '/support');
  assert.deepEqual(alternates(page('/support')), {
    de: 'https://hummlist.com/support',
    en: 'https://hummlist.com/en/support',
    'x-default': 'https://hummlist.com/support',
  });
});

test('a production build leaves the drafts out: the paths answer 404 as before', async () => {
  const { outDir } = buildSite({ files: filled(), env: PROD });
  const routes = htmlRoutes(outDir);
  for (const route of SUPPORT) assert.ok(!routes.includes(route), `${route} not built`);
  for (const route of routes) {
    const html = readFileSync(join(outDir, route === '/' ? 'index.html' : `${route.slice(1)}.html`), 'utf8');
    assert.doesNotMatch(html, /ENTWURF|DRAFT/, `${route} has no draft banner`);
    assert.doesNotMatch(html, /href="\/(en\/)?support"/, `${route} links no support page`);
  }
  const res = await serve(outDir, SUPPORT);
  for (const route of SUPPORT) {
    assert.equal(res[route].status, 404, route);
    assert.match(res[route].body, /Seite nicht gefunden/, route);
  }
});

test('a placeholder in a draft warns in preview and does not block production', () => {
  const files = { 'legal/support.md': readFileSync(join(CONTENT_DIR, 'legal/support.md'), 'utf8').replace('# Hilfe und Kontakt', '# Hilfe und Kontakt\n\n[PETER: Telefon]') };
  assert.match(buildSite({ files }).warnings.join('\n'), /legal\/support\.md: \[PETER: Telefon\]/);
  assert.deepEqual(buildSite({ files: filled(files), env: PROD }).warnings, []);
});

test('published (draft removed): no banner, and production fails on a placeholder left', () => {
  const read = (f) => readFileSync(join(CONTENT_DIR, f), 'utf8');
  const files = { 'legal/support.md': published(read('legal/support.md')), 'legal/support-en.md': published(read('legal/support-en.md')) };
  const { page } = buildSite({ files: filled(files), env: PROD });
  for (const route of SUPPORT) {
    assert.equal(page(route).querySelector('.draft-banner'), null, route);
    assert.equal(meta(page(route), 'robots'), undefined, route);
  }
  files['legal/support.md'] += '\n[PETER: Telefon]\n';
  assert.throws(() => buildSite({ files: filled(files), env: PROD }), /legal\/support\.md: \[PETER: Telefon\]/);
});

test('a footer link to a draft page fails the production build', () => {
  assert.throws(() => buildSite({ files: filled(), env: PROD, config: { supportPublished: true } }), /broken internal link \/(en\/)?support/);
});

test('draft must be a boolean', () => {
  const text = legal({ locale: 'de', path: '/x', key: 'x' }).replace('updated:', 'draft: yes please\nupdated:');
  assert.throws(() => buildSite({ files: { 'legal/x.md': text } }), /legal\/x\.md: frontmatter field "draft" must be true or false/);
});
