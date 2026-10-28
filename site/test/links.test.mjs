import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, guide, legal, hrefs, alternates, htmlRoutes } from './helpers.mjs';

const SITE = 'https://hummlist.com';
const switchLink = (doc) => {
  const a = doc.querySelector('header nav a');
  return { href: a.getAttribute('href'), lang: a.getAttribute('lang'), hreflang: a.getAttribute('hreflang') };
};

test('the Siri guide pair switches language and lists both alternates', () => {
  const { page } = buildSite();
  const de = page('/de/anleitungen/siri-kurzbefehl');
  const en = page('/en/guides/siri-shortcut');
  assert.equal(de.querySelector('html').getAttribute('lang'), 'de');
  assert.equal(en.querySelector('html').getAttribute('lang'), 'en');
  assert.deepEqual(switchLink(de), { href: '/en/guides/siri-shortcut', lang: 'en', hreflang: 'en' });
  assert.deepEqual(switchLink(en), { href: '/de/anleitungen/siri-kurzbefehl', lang: 'de', hreflang: 'de' });
  const expected = {
    de: `${SITE}/de/anleitungen/siri-kurzbefehl`,
    en: `${SITE}/en/guides/siri-shortcut`,
    'x-default': `${SITE}/de/anleitungen/siri-kurzbefehl`,
  };
  assert.deepEqual(alternates(de), expected);
  assert.deepEqual(alternates(en), expected);
});

test('indexes and the imprint pair with each other', () => {
  const { page } = buildSite();
  assert.deepEqual(switchLink(page('/de/anleitungen')).href, '/en/guides');
  assert.deepEqual(switchLink(page('/en/guides')).href, '/de/anleitungen');
  assert.deepEqual(switchLink(page('/impressum')).href, '/en/imprint');
  assert.deepEqual(alternates(page('/en/imprint')), { de: `${SITE}/impressum`, en: `${SITE}/en/imprint`, 'x-default': `${SITE}/impressum` });
});

test('a guide without translation links to the other index and has no alternate for it', () => {
  const { page } = buildSite({
    files: {
      'guides/en/only-english.md': guide({ locale: 'en', slug: 'only-english' }),
      'guides/de/nur-deutsch.md': guide({ locale: 'de', slug: 'nur-deutsch' }),
    },
  });
  const en = page('/en/guides/only-english');
  assert.equal(switchLink(en).href, '/de/anleitungen');
  assert.deepEqual(alternates(en), { en: `${SITE}/en/guides/only-english`, 'x-default': `${SITE}/en/guides/only-english` });
  const de = page('/de/anleitungen/nur-deutsch');
  assert.equal(switchLink(de).href, '/en/guides');
  assert.deepEqual(alternates(de), { de: `${SITE}/de/anleitungen/nur-deutsch`, 'x-default': `${SITE}/de/anleitungen/nur-deutsch` });
});

test('the site name links to the locale index', () => {
  const { page } = buildSite();
  assert.equal(page('/en/imprint').querySelector('header a').getAttribute('href'), '/en/guides');
  assert.equal(page('/impressum').querySelector('header a').getAttribute('href'), '/de/anleitungen');
});

const footer = (doc) => doc.querySelectorAll('footer a').map((a) => [a.text, a.getAttribute('href')]);

test('with legalPublished false the footer links only the imprint', () => {
  const { outDir, page } = buildSite({ config: { legalPublished: false } });
  assert.deepEqual(footer(page('/de/anleitungen/siri-kurzbefehl')), [['Impressum', '/impressum']]);
  assert.deepEqual(footer(page('/en/guides')), [['Imprint', '/en/imprint']]);
  for (const route of htmlRoutes(outDir)) {
    const links = hrefs(page(route));
    for (const path of ['/datenschutz', '/privacy', '/support']) assert.ok(!links.includes(path), `${route} links ${path}`);
    assert.equal(page(route).querySelectorAll('footer li').filter((li) => !li.text.trim()).length, 0, `${route} has empty footer items`);
  }
});

test('with legalPublished true and the pages present the footer links them', () => {
  const { page } = buildSite({
    config: { legalPublished: true },
    files: {
      'legal/datenschutz.md': legal({ locale: 'de', path: '/datenschutz', key: 'privacy' }),
      'legal/privacy.md': legal({ locale: 'en', path: '/privacy', key: 'privacy' }),
      'legal/support.md': legal({ locale: 'de', path: '/support', key: 'support' }),
    },
  });
  assert.deepEqual(footer(page('/de/anleitungen')), [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Hilfe', '/support']]);
  assert.deepEqual(footer(page('/en/guides')), [['Imprint', '/en/imprint'], ['Privacy', '/privacy'], ['Support', '/support']]);
});

test('with legalPublished true but no pages the build fails on the broken link', () => {
  assert.throws(() => buildSite({ config: { legalPublished: true } }), /broken internal link \/(datenschutz|privacy|support)/);
});

test('a broken internal link in content fails the build', () => {
  const body = '# Broken\n\nSee [missing](/de/anleitungen/gibt-es-nicht#teil).\n';
  assert.throws(
    () => buildSite({ files: { 'guides/de/kaputt.md': guide({ locale: 'de', slug: 'kaputt', body }) } }),
    /de\/anleitungen\/kaputt\.html: broken internal link \/de\/anleitungen\/gibt-es-nicht#teil/,
  );
});
