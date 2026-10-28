import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, legal } from './helpers.mjs';

const withPlaceholder = {
  'legal/impressum.md': legal({ locale: 'de', path: '/impressum', key: 'imprint', title: 'Impressum', body: '# Impressum\n\n[PETER: Anschrift]\n' }),
};

test('a placeholder builds with a warning outside production', () => {
  for (const env of [{ VERCEL_ENV: 'preview' }, {}]) {
    const { warnings, page } = buildSite({ files: withPlaceholder, env });
    assert.match(warnings.join('\n'), /legal\/impressum\.md: \[PETER: Anschrift\]/);
    assert.match(page('/impressum').querySelector('main').text, /\[PETER: Anschrift\]/);
  }
});

test('a placeholder fails the production build naming file and placeholder', () => {
  assert.throws(() => buildSite({ files: withPlaceholder, env: { VERCEL_ENV: 'production' } }), /legal\/impressum\.md: \[PETER: Anschrift\]/);
});

test('the real content builds in production without warnings', () => {
  assert.deepEqual(buildSite({ env: { VERCEL_ENV: 'production' } }).warnings, []);
});
