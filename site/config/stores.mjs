// Where the launch stage's badges, QR code and /get send people (job 82 ADDENDUM 8). Replace
// each TODO with the public listing URL once it exists; until then the badges and /get lead to
// the landing page.
export const STORE_URLS = {
  appStore: 'TODO: App Store URL once the listing is public',
  googlePlay: 'TODO: Google Play URL once the listing is public',
};

export const GET_URL = 'https://hummlist.com/get';

export const storeUrlSet = (url) => url.startsWith('https://');
