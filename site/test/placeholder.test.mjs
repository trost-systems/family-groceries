import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite, legal, CONTENT_DIR } from './helpers.mjs';

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

test('the real content builds in production once its placeholders are filled', () => {
  const filled = Object.fromEntries(
    readdirSync(CONTENT_DIR, { recursive: true })
      .filter((f) => f.endsWith('.md'))
      .map((f) => [f, readFileSync(join(CONTENT_DIR, f), 'utf8').replace(/\[PETER:[^\]]*\]/g, 'filled')]),
  );
  assert.deepEqual(buildSite({ files: filled, env: { VERCEL_ENV: 'production' } }).warnings, []);
});
