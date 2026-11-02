import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite } from './helpers.mjs';

test('the menu prototypes review page is in the preview build, noindex', () => {
  const { page } = buildSite();
  const doc = page('/internal/menu-prototypes');
  assert.equal(doc.querySelector('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
  assert.equal(doc.querySelectorAll('section.proposal').length, 6);
});

test('production leaves the menu prototypes out', () => {
  const { outDir } = buildSite({ env: { VERCEL_ENV: 'production' } });
  assert.ok(!existsSync(join(outDir, 'internal')));
});
