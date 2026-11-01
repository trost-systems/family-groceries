import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite, guide, hrefs, htmlRoutes, CONTENT_DIR } from './helpers.mjs';

const listed = (doc) => doc.querySelectorAll('main li').map((li) => ({ href: li.querySelector('a').getAttribute('href'), text: li.text }));

test('real content builds every route', () => {
  const { outDir } = buildSite();
  const routes = htmlRoutes(outDir);
  for (const route of ['/', '/de/anleitungen/siri-kurzbefehl', '/en/guides/siri-shortcut', '/de/anleitungen/alexa', '/en/guides/alexa', '/de/anleitungen', '/en/guides', '/impressum', '/en/imprint']) {
    assert.ok(routes.includes(route), `${route} is built`);
  }
});

test('each index lists only its own locale with title and description', () => {
  const { page } = buildSite();
  const de = listed(page('/de/anleitungen'));
  assert.deepEqual(de.map((g) => g.href), ['/de/anleitungen/widget', '/de/anleitungen/alexa', '/de/anleitungen/siri-kurzbefehl']);
  assert.match(de[0].text, /Hummlist auf dem Home-Bildschirm: das Widget/);
  assert.match(de[1].text, /Hummlist per Alexa: Skill einrichten/);
  assert.match(de[1].text, /Mit dem Alexa-Skill „Hummlist“ setzt du Sachen per Sprache auf deine Hummlist/);
  assert.match(de[2].text, /Hummlist per Siri: Kurzbefehl einrichten/);
  assert.match(de[2].text, /Mit einem Kurzbefehl setzt du per Siri Sachen auf deine Hummlist/);
  const en = listed(page('/en/guides'));
  assert.deepEqual(en.map((g) => g.href), ['/en/guides/widget', '/en/guides/alexa', '/en/guides/siri-shortcut']);
  assert.match(en[0].text, /Hummlist on your Home Screen: the widget/);
  assert.match(en[1].text, /Hummlist with Alexa \(German only for now\)/);
  assert.match(en[2].text, /Hummlist with Siri \(German only for now\)/);
  assert.match(en[2].text, /works in German only for now/);
});

test('a new guide file appears at its route and on its index', () => {
  const { page } = buildSite({
    files: { 'guides/de/einkauf-teilen.md': guide({ locale: 'de', slug: 'einkauf-teilen', title: 'Einkauf teilen', description: 'So teilst du die Liste.' }) },
  });
  assert.equal(page('/de/anleitungen/einkauf-teilen').querySelector('h1').text, 'Einkauf teilen');
  const de = listed(page('/de/anleitungen'));
  assert.deepEqual(de.map((g) => g.href), ['/de/anleitungen/einkauf-teilen', '/de/anleitungen/widget', '/de/anleitungen/alexa', '/de/anleitungen/siri-kurzbefehl'], 'sorted by title');
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

test('the EN Alexa stub says German only and links to the German guide', () => {
  const doc = buildSite().page('/en/guides/alexa');
  assert.match(doc.querySelector('main').text, /only works in German/);
  assert.ok(hrefs(doc, 'main a').includes('/de/anleitungen/alexa'));
});

test('the dialogue renders as separate lines and other paragraphs get no line break', () => {
  const doc = buildSite().page('/de/anleitungen/siri-kurzbefehl');
  const dialogues = doc.querySelectorAll('main blockquote p').filter((p) => /^Du:/.test(p.text));
  assert.equal(dialogues.length, 2, 'the Shortcut and the native Siri dialogue');
  for (const dialogue of dialogues) assert.equal(dialogue.querySelectorAll('br').length, 3);
  const others = doc.querySelectorAll('main p').filter((p) => !dialogues.includes(p) && p.querySelector('br'));
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

test('the imprint pair shows the VAT ID (§ 5 Abs. 1 Nr. 6 DDG) under the personal name, no IAKUVO', () => {
  const { page } = buildSite();
  const de = page('/impressum').querySelector('main').text;
  assert.match(de, /Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE369514299/);
  assert.match(de, /Peter Trost/);
  const en = page('/en/imprint').querySelector('main').text;
  assert.match(en, /VAT ID pursuant to § 27a UStG: DE369514299/);
  for (const text of [de, en]) assert.doesNotMatch(text, /IAKUVO/);
});
