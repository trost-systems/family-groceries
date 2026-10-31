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

const LEGAL_PATHS = ['/datenschutz', '/en/privacy', '/privacy', '/support', '/en/support'];

test('with nothing published the footer links only the imprint', () => {
  const { outDir, page } = buildSite({ config: { privacyPublished: false, supportPublished: false } });
  assert.deepEqual(footer(page('/de/anleitungen/siri-kurzbefehl')), [['Impressum', '/impressum'], ['Neuigkeiten', '/de/changelog']]);
  assert.deepEqual(footer(page('/en/guides')), [['Imprint', '/en/imprint'], ["What's new", '/en/changelog']]);
  for (const route of htmlRoutes(outDir)) {
    const links = page(route).querySelectorAll('footer a').map((a) => a.getAttribute('href'));
    for (const path of LEGAL_PATHS) assert.ok(!links.includes(path), `${route} links ${path} in the footer`);
    assert.equal(page(route).querySelectorAll('footer li').filter((li) => !li.text.trim()).length, 0, `${route} has empty footer items`);
  }
});

test('the published privacy policy is in the footer of every page, support is not', () => {
  const { outDir, page } = buildSite({ config: { privacyPublished: true, supportPublished: false } });
  for (const route of htmlRoutes(outDir).filter((r) => r !== '/' && r !== '/404')) {
    const locale = page(route).querySelector('html').getAttribute('lang');
    const expected = locale === 'de'
      ? [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Neuigkeiten', '/de/changelog']]
      : [['Imprint', '/en/imprint'], ['Privacy', '/en/privacy'], ["What's new", '/en/changelog']];
    assert.deepEqual(footer(page(route)), expected, route);
  }
});

test('the privacy policy pair switches language and has the rights anchor', () => {
  const { page } = buildSite();
  assert.equal(switchLink(page('/datenschutz')).href, '/en/privacy');
  assert.equal(switchLink(page('/en/privacy')).href, '/datenschutz');
  assert.deepEqual(alternates(page('/en/privacy')), { de: `${SITE}/datenschutz`, en: `${SITE}/en/privacy`, 'x-default': `${SITE}/datenschutz` });
  assert.match(page('/datenschutz').querySelector('#rechte').text, /^15\. Deine Rechte$/);
  assert.match(page('/en/privacy').querySelector('#rights').text, /^15\. Your rights$/);
});

test('with support published and its page present the footer links it too', () => {
  const { page } = buildSite({
    config: { privacyPublished: true, supportPublished: true },
    files: { 'legal/support.md': legal({ locale: 'de', path: '/support', key: 'support' }) },
  });
  assert.deepEqual(footer(page('/de/anleitungen')), [['Impressum', '/impressum'], ['Datenschutz', '/datenschutz'], ['Hilfe', '/support'], ['Neuigkeiten', '/de/changelog']]);
  assert.deepEqual(footer(page('/en/guides')), [['Imprint', '/en/imprint'], ['Privacy', '/en/privacy'], ['Support', '/en/support'], ["What's new", '/en/changelog']]);
});

test('a published flag without its page fails the build on the broken link', () => {
  // Production leaving the drafts out breaks the link the same way (draft.test.mjs).
  assert.throws(() => buildSite({ config: { supportPublished: true }, files: { 'legal/support.md': null, 'legal/support-en.md': null } }), /broken internal link \/(en\/)?support/);
  assert.throws(
    () => buildSite({ config: { privacyPublished: true }, files: { 'legal/privacy.md': null } }),
    /broken internal link \/en\/privacy/,
  );
});

test('a broken internal link in content fails the build', () => {
  const body = '# Broken\n\nSee [missing](/de/anleitungen/gibt-es-nicht#teil).\n';
  assert.throws(
    () => buildSite({ files: { 'guides/de/kaputt.md': guide({ locale: 'de', slug: 'kaputt', body }) } }),
    /de\/anleitungen\/kaputt\.html: broken internal link \/de\/anleitungen\/gibt-es-nicht#teil/,
  );
});
