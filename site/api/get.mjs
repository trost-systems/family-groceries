// hummlist.com/get, the launch stage's smart link (job 82 ADDENDUM 8; vercel.json rewrites /get
// here): a phone goes to its store, everything else, and every phone while its store URL is still
// a TODO, to the landing page in the browser's language, which shows both badges.
import { STORE_URLS, storeUrlSet } from '../config/stores.mjs';

export function storeFor(userAgent, urls = STORE_URLS) {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent) && storeUrlSet(urls.appStore)) return urls.appStore;
  if (/\bAndroid\b/.test(userAgent) && storeUrlSet(urls.googlePlay)) return urls.googlePlay;
  return null;
}

export function getApp(request, urls = STORE_URLS) {
  const store = storeFor(request.headers.get('user-agent') ?? '', urls);
  const landing = /^\s*de/i.test(request.headers.get('accept-language') ?? 'de') ? '/de' : '/en';
  return new Response(null, {
    status: 302,
    headers: { location: store ?? landing, 'cache-control': 'no-store', vary: 'user-agent, accept-language' },
  });
}

export const GET = (request) => getApp(request);
