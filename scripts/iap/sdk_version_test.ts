import { assert, assertExists } from 'jsr:@std/assert@^1';

// What RevenueCat's SDK hands Apple and Google and keeps on the device was read from its source at
// the versions purchases_flutter pins (job 47, H-68/H-73). A new locked version needs that reading
// again: the docs name the version they were checked against, and this fails until they match.
const lock = await Deno.readTextFile(new URL('../../app/pubspec.lock', import.meta.url));
const locked = /\n {2}purchases_flutter:\n(?: {4}.*\n)*? {4}version: "([^"]+)"/.exec(lock)?.[1];

Deno.test('pubspec.lock pins purchases_flutter', () => {
  assertExists(locked, 'app/pubspec.lock has no purchases_flutter version');
});

for (const file of ['docs/PURCHASES.md', 'docs/PRIVACY_DATA_MAP.md']) {
  Deno.test(`${file} states the SDK facts for the locked purchases_flutter`, async () => {
    const text = await Deno.readTextFile(new URL(`../../${file}`, import.meta.url));
    const stamp = `SDK facts checked for purchases_flutter ${locked}`;
    assert(
      text.includes(stamp),
      `${file} should say "${stamp}": read purchases-ios and purchases-android at the versions ` +
        `purchases_flutter ${locked} pins and update "What Apple and Google receive" and the ` +
        `device storage row (docs/PURCHASES.md)`,
    );
  });
}
