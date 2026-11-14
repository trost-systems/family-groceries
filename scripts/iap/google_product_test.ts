import { assertEquals, assertMatch } from 'jsr:@std/assert@^1';
import { applyRefusal } from './google_product.ts';
import { product } from './product.ts';

const price = { currency: 'EUR', amount: '149.99' };

Deno.test('a dry run needs no confirmation', () => {
  assertEquals(applyRefusal([], price), null);
});

Deno.test('--apply without --confirm-price writes nothing', () => {
  assertMatch(applyRefusal(['--apply'], price) ?? '', /add --confirm-price 149\.99/);
  assertMatch(applyRefusal(['--apply', '--confirm-price'], price) ?? '', /add --confirm-price/);
});

Deno.test('--apply with another price writes nothing', () => {
  for (const given of ['29.99', '9.99', '149.9', '1499.9']) {
    assertMatch(applyRefusal(['--apply', '--confirm-price', given], price) ?? '', /not the base/);
  }
});

Deno.test('--apply with the base price may write, in either flag form', () => {
  assertEquals(applyRefusal(['--apply', '--confirm-price', '149.99'], price), null);
  assertEquals(applyRefusal(['--confirm-price=149.990', '--apply'], price), null);
});

Deno.test('the script confirms against the Lifetime base price', () => {
  assertEquals(
    applyRefusal(['--apply', '--confirm-price', product.basePrice.amount]),
    null,
  );
  assertMatch(applyRefusal(['--apply', '--confirm-price', '0.99']) ?? '', /not the base/);
});
