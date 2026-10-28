import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite, guide, hrefs, htmlRoutes, CONTENT_DIR } from './helpers.mjs';

const listed = (doc) => doc.querySelectorAll('main li').map((li) => ({ href: li.querySelector('a').getAttribute('href'), text: li.text }));

test('real content builds every route', () => {
  const { outDir } = buildSite();
  const routes = htmlRoutes(outDir);
  for (const route of ['/', '/de/anleitungen/siri-kurzbefehl', '/en/guides/siri-shortcut', '/de/anleitungen', '/en/guides', '/impressum', '/en/imprint']) {
    assert.ok(routes.includes(route), `${route} is built`);
  }
});

test('each index lists only its own locale with title and description', () => {
  const { page } = buildSite();
  const de = listed(page('/de/anleitungen'));
  assert.equal(de.length, 1);
  assert.equal(de[0].href, '/de/anleitungen/siri-kurzbefehl');
  assert.match(de[0].text, /Hummlist per Siri: Kurzbefehl einrichten/);
  assert.match(de[0].text, /Mit einem Kurzbefehl setzt du per Siri Sachen auf deine Hummlist/);
  const en = listed(page('/en/guides'));
  assert.equal(en.length, 1);
  assert.equal(en[0].href, '/en/guides/siri-shortcut');
  assert.match(en[0].text, /Hummlist with Siri \(German only for now\)/);
  assert.match(en[0].text, /works in German only for now/);
});

test('a new guide file appears at its route and on its index', () => {
  const { page } = buildSite({
    files: { 'guides/de/einkauf-teilen.md': guide({ locale: 'de', slug: 'einkauf-teilen', title: 'Einkauf teilen', description: 'So teilst du die Liste.' }) },
  });
  assert.equal(page('/de/anleitungen/einkauf-teilen').querySelector('h1').text, 'Einkauf teilen');
  const de = listed(page('/de/anleitungen'));
  assert.deepEqual(de.map((g) => g.href), ['/de/anleitungen/einkauf-teilen', '/de/anleitungen/siri-kurzbefehl'], 'sorted by title');
  assert.match(de[0].text, /So teilst du die Liste\./);
  assert.ok(!hrefs(page('/en/guides')).includes('/de/anleitungen/einkauf-teilen'));
});

for (const field of ['description', 'translation_key', 'updated', 'title']) {
  test(`a guide missing ${field} fails naming file and field`, () => {
    assert.throws(
      () => buildSite({ files: { 'guides/en/broken.md': guide({ locale: 'en', slug: 'broken', omit: [field] }) } }),
      (e) => e.message.includes('guides/en/broken.md') && e.message.includes(`"${field}"`),
    );
  });
}

test('a guide whose locale or slug disagrees with its location fails', () => {
  assert.throws(() => buildSite({ files: { 'guides/en/x.md': guide({ locale: 'de', slug: 'x' }) } }), /guides\/en\/x\.md.*"locale"/);
  assert.throws(() => buildSite({ files: { 'guides/en/x.md': guide({ locale: 'en', slug: 'y' }) } }), /guides\/en\/x\.md.*"slug"/);
});

test('an invalid updated date fails', () => {
  const text = guide({ locale: 'en', slug: 'x' }).replace('2026-10-01', 'yesterday');
  assert.throws(() => buildSite({ files: { 'guides/en/x.md': text } }), /guides\/en\/x\.md.*"updated"/);
});

test('two files with the same route fail', () => {
  const clash = '---\ntitle: X\ndescription: Y\nlocale: de\npath: /de/anleitungen/siri-kurzbefehl\ntranslation_key: clash\nupdated: 2026-10-01\n---\n\n# X\n';
  assert.throws(() => buildSite({ files: { 'legal/clash.md': clash } }), /route \/de\/anleitungen\/siri-kurzbefehl/);
});

test('the EN stub says German only and links to the German guide', () => {
  const doc = buildSite().page('/en/guides/siri-shortcut');
  assert.match(doc.querySelector('main').text, /only works in German/);
  assert.ok(hrefs(doc, 'main a').includes('/de/anleitungen/siri-kurzbefehl'));
});

test('the dialogue renders as separate lines and other paragraphs get no line break', () => {
  const doc = buildSite().page('/de/anleitungen/siri-kurzbefehl');
  const dialogue = doc.querySelector('main blockquote p');
  assert.equal(dialogue.querySelectorAll('br').length, 3);
  const others = doc.querySelectorAll('main p').filter((p) => p !== dialogue && p.querySelector('br'));
  assert.deepEqual(others.map((p) => p.text), []);
});

const TOKEN = /fgp_[A-Za-z0-9_-]{43}/;
const filesUnder = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => join(d.parentPath ?? d.path, d.name));

test('no real access token in content or build output', () => {
  const { outDir } = buildSite();
  for (const file of [...filesUnder(CONTENT_DIR), ...filesUnder(outDir)]) {
    assert.doesNotMatch(readFileSync(file, 'latin1'), TOKEN, file);
  }
  assert.match(`fgp_${'a'.repeat(43)}`, TOKEN, 'the pattern detects a token-shaped value');
});
