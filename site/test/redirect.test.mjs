// S3 of the Hummlist -> Snacklist rename: hummlist.com and www.hummlist.com redirect (308, path and
// query kept) to snacklist.app, except /data/ (JSON the old Hummlist apps fetch cross-origin) and /api/
// (waitlist posts and unsubscribe links from mails already sent). app.hummlist.com and
// mcp.hummlist.com are other Vercel projects and keep serving.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('the hummlist.com host redirects come first, are permanent and keep the path', () => {
  const [apex, www] = config.redirects;
  for (const [rule, host] of [[apex, 'hummlist.com'], [www, 'www.hummlist.com']]) {
    assert.deepEqual(rule.has, [{ type: 'host', value: host }]);
    assert.equal(rule.permanent, true);
    assert.equal(rule.destination, 'https://snacklist.app/$1');
  }
  assert.equal(www.source, apex.source);
  const others = config.redirects.slice(2);
  assert.ok(others.every((r) => !JSON.stringify(r).includes('hummlist')), 'no other host rule');
});

test('the source pattern skips /data/ and /api/ and catches every other path', () => {
  const source = new RegExp(`^${config.redirects[0].source}$`);
  for (const path of ['/', '/de', '/datenschutz', '/en/privacy', '/de/anleitungen/alexa', '/get', '/llms.txt', '/database']) {
    assert.ok(source.test(path), path);
  }
  for (const path of ['/data/item-icons.v1.json', '/api/waitlist', '/api/waitlist/unsubscribe']) {
    assert.ok(!source.test(path), path);
  }
  assert.equal(source.exec('/en/privacy')[1], 'en/privacy');
});
