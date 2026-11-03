import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { CONTENT_DIR, buildSite, htmlRoutes } from './helpers.mjs';
import { parseVariations } from '../waitlist-variations.mjs';

const SOURCE = readFileSync(join(CONTENT_DIR, 'internal/waitlist-variations.yml'), 'utf8');
const PROD = { VERCEL_ENV: 'production' };
const VARIANTS = ['v1', 'v2', 'v3', 'v4', 'v5'];
const PAGES = VARIANTS.flatMap((v) => ['de', 'en'].map((l) => `/internal/waitlist/${v}/${l}`));

// The "Reihenfolge" of each variant in Launch's copy, header and footer aside.
const ORDER = {
  v1: ['hero', 'points', 'extra', 'note', 'faq', 'closing'],
  v2: ['hero', 'chat', 'points', 'line', 'faq', 'closing'],
  v3: ['hero', 'steps', 'points', 'line', 'faq', 'closing'],
  v4: ['hero', 'steps', 'points', 'line', 'faq', 'closing'],
  v5: ['hero', 'faq'],
};

const preview = buildSite();

test('a preview build has the index and every variant in German and English', () => {
  const routes = htmlRoutes(preview.outDir);
  for (const route of ['/internal/waitlist', ...PAGES]) assert.ok(routes.includes(route), route);
});

test('a production build has no variation page and no variation file', () => {
  const { outDir } = buildSite({ env: PROD });
  assert.deepEqual(htmlRoutes(outDir).filter((r) => r.startsWith('/internal')), []);
  assert.ok(!existsSync(join(outDir, 'internal')));
});

test('each variant shows its blocks in the order of the copy, in both languages', () => {
  for (const route of PAGES) {
    const id = route.split('/')[3];
    const blocks = preview.page(route).querySelectorAll('[data-block]').map((el) => el.getAttribute('data-block'));
    assert.deepEqual(blocks, ORDER[id], route);
  }
});

test('the pages are noindex, never link the web app and keep to the copy rules', () => {
  const retailers = /\b(rewe|edeka|lidl|aldi|kaufland|penny|netto|rossmann|dm-markt|globus|real)\b/i;
  for (const route of ['/internal/waitlist', ...PAGES]) {
    const page = preview.page(route);
    const html = page.toString();
    assert.match(page.querySelector('meta[name="robots"]').getAttribute('content'), /noindex/, route);
    assert.doesNotMatch(html, /app\.hummlist\.com/, route);
    assert.doesNotMatch(page.text, /\bHumm\b/, `${route} says "Humm" alone`);
    assert.doesNotMatch(page.text, /Premium/, route);
    assert.doesNotMatch(page.text, retailers, route);
  }
});

test('the mock form has no action and no endpoint', () => {
  for (const route of PAGES) {
    const form = preview.page(route).querySelector('form.wl-form');
    assert.equal(form.getAttribute('action'), undefined, route);
    assert.equal(form.querySelectorAll('input[type="hidden"]').length, 0, route);
  }
  const script = readFileSync(join(preview.outDir, 'internal/waitlist.js'), 'utf8');
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|sendBeacon|\.submit\(|WebSocket|EventSource/);
});

test('every reviewer marker of the copy shows on its page, and the legal placeholders stay visible', () => {
  const data = yaml.safeLoad(SOURCE);
  for (const id of VARIANTS) {
    for (const locale of ['de', 'en']) {
      const route = `/internal/waitlist/${id}/${locale}`;
      const page = preview.page(route);
      const own = yaml.safeDump(data.variants[id][locale]);
      const markers = own.match(/\[(LEGAL CHECK|PM CHECK:[^\]]*|PETER CHECK:[^\]]*)\]|\((Uhrzeiten|Times)[^)]*\)/g) ?? [];
      const shown = page.querySelectorAll('.rv-note').map((n) => n.text);
      assert.deepEqual(shown.sort(), markers.map((m) => m.replace(/\s+/g, ' ')).sort(), route);
      const legal = page.querySelectorAll('mark.wv-legal').map((m) => m.text);
      assert.ok(legal.some((m) => m.startsWith('[LEGAL: ')), `${route} has no consent placeholder`);
    }
  }
});

test('every FAQ ends with the four install questions', () => {
  const install = { de: 'Wie installiere ich die Beta auf dem iPhone?', en: 'How do I install the beta on iPhone?' };
  for (const route of PAGES) {
    const questions = preview.page(route).querySelectorAll('.faq-item summary').map((s) => s.text);
    const locale = route.slice(-2);
    assert.equal(questions.at(-4), install[locale], route);
    assert.doesNotMatch(preview.page(route).text, /INSTALL-FAQ/, route);
  }
});

test('the heroes carry Launch’s titles, and V1’s founder note opens with the new first sentence', () => {
  const titles = {
    v1: ['Gemeinsam einkaufen, ohne Werbung', 'Shop together, no ads'],
    v2: ['Sag&#39;s Claude. Es steht auf eurer Liste.', 'Tell Claude. It&#39;s on your list.'],
    v3: ['Zu Hause aufgeschrieben, im Laden schon da', 'Added at home, already there at the store'],
    v4: ['Deine Liste, sortiert wie dein Laden', 'Your list, sorted the way you walk the store'],
    v5: ['Gemeinsam einkaufen, ohne Werbung', 'Shop together, no ads'],
  };
  for (const [id, [de, en]] of Object.entries(titles)) {
    assert.equal(preview.page(`/internal/waitlist/${id}/de`).querySelector('h1').innerHTML, de);
    assert.equal(preview.page(`/internal/waitlist/${id}/en`).querySelector('h1').innerHTML, en);
  }
  const note = preview.page('/internal/waitlist/v1/de').querySelector('.wv-note blockquote').text;
  assert.ok(note.startsWith('Ich wollte eine App, die ich mit meiner Frau teilen und KI für mich verwalten kann.'), note);
});

test('V5 has no header button; the others jump to the form', () => {
  for (const route of PAGES) {
    const cta = preview.page(route).querySelector('.site-header .header-cta');
    if (route.includes('/v5/')) assert.equal(cta, null, route);
    else assert.match(cta.getAttribute('href'), /^#(warteliste|waitlist)$/, route);
  }
});

test('a variant whose languages differ in blocks, or with an unknown block, fails the build', () => {
  const data = yaml.safeLoad(SOURCE);
  data.variants.v3.en.blocks.splice(1, 1);
  assert.throws(() => parseVariations(yaml.safeDump(data), 'x.yml'), /v3: de and en must have the same blocks/);
  const typo = yaml.safeLoad(SOURCE);
  typo.variants.v1.de.blocks[1].type = 'pionts';
  assert.throws(() => parseVariations(yaml.safeDump(typo), 'x.yml'), /unknown type "pionts"/);
});
