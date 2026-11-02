import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite, publicWith } from './helpers.mjs';

const REVIEW = { 'internal/review.html': '<!doctype html><html lang="de"><head><title>Review</title><meta name="robots" content="noindex, nofollow"></head><body><h1>Review</h1></body></html>' };

test('a review page under public/internal/ is built in preview', () => {
  const { outDir } = buildSite({ publicDir: publicWith(REVIEW) });
  assert.ok(existsSync(join(outDir, 'internal/review.html')));
});

test('production leaves public/internal/ out', () => {
  const { outDir } = buildSite({ publicDir: publicWith(REVIEW), env: { VERCEL_ENV: 'production' } });
  assert.ok(!existsSync(join(outDir, 'internal')));
});

test('the store frames review page is in the preview build, noindex', () => {
  const { page } = buildSite();
  assert.equal(page('/internal/store-frames').querySelector('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
});
