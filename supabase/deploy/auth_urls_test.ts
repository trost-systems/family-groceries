import { assertEquals, assertThrows } from '@std/assert';
import { desired } from './auth_urls.ts';

Deno.test('the app URL becomes the Site URL and leads the redirect list', () => {
  const d = desired(
    'com.petertrost.familygroceries://login-callback,https://family-groceries-pied.vercel.app/**',
    'https://app.hummlist.com/',
  );
  assertEquals(d.site_url, 'https://app.hummlist.com');
  assertEquals(d.uri_allow_list.split(','), [
    'https://app.hummlist.com/**',
    'com.hummlist.app://login-callback',
    'com.petertrost.familygroceries://login-callback',
    'https://family-groceries-pied.vercel.app/**',
  ]);
  assertEquals(d.oauth_server_enabled, true);
  assertEquals(d.oauth_server_authorization_path, '/oauth/consent');
});

Deno.test('redirects added by hand are kept, and rerunning changes nothing', () => {
  const once = desired(
    'https://other.example/**',
    'https://fg.vercel.app',
    'https://fg-*-t.vercel.app',
  );
  assertEquals(once.uri_allow_list.split(',').includes('https://other.example/**'), true);
  assertEquals(once.uri_allow_list.split(',')[1], 'https://fg-*-t.vercel.app/**');
  assertEquals(
    desired(once.uri_allow_list, 'https://fg.vercel.app', 'https://fg-*-t.vercel.app'),
    once,
  );
});

Deno.test('only a bare https origin is accepted as the app URL', () => {
  assertThrows(() => desired('', 'http://fg.vercel.app'), Error, 'https origin');
  assertThrows(() => desired('', 'https://fg.vercel.app/oauth/consent'), Error, 'https origin');
});
