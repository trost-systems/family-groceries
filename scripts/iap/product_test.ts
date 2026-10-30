import { assertEquals } from 'jsr:@std/assert@^1';
import { lifetimeProductId } from '../../supabase/functions/purchases/types.ts';
import {
  availabilityBody,
  basePricePoint,
  createProductBody,
  priceScheduleBody,
} from './apple_product.ts';
import { oneTimeProductBody } from './google_product.ts';
import { money, product } from './product.ts';

Deno.test('the product id is the one the purchases function sells', () => {
  assertEquals(product.id, lifetimeProductId);
});

Deno.test('the StoreKit configuration file mirrors the product', async () => {
  const storekit = JSON.parse(
    await Deno.readTextFile(new URL('../../app/ios/Hummlist.storekit', import.meta.url)),
  );
  const [p] = storekit.products;
  assertEquals(storekit.products.length, 1);
  assertEquals(
    [p.productID, p.type, p.displayPrice, p.familyShareable, p.referenceName],
    [product.id, 'NonConsumable', product.basePrice.amount, false, product.referenceName],
  );
  assertEquals(
    p.localizations.map((
      l: { displayName: string; description: string },
    ) => [l.displayName, l.description]),
    product.listings.map((l) => [l.name, l.description]),
  );
  assertEquals(storekit.settings._storefront, product.basePrice.territory);
});

Deno.test('Apple: a non-consumable without Family Sharing, priced in Germany', () => {
  const body = createProductBody() as { data: { attributes: Record<string, unknown> } };
  assertEquals(body.data.attributes, {
    name: 'Hummlist Lifetime',
    productId: 'com.hummlist.app.lifetime',
    inAppPurchaseType: 'NON_CONSUMABLE',
    familySharable: false,
  });
  const schedule = priceScheduleBody('iap1', 'pp1') as {
    data: { relationships: { baseTerritory: { data: { id: string } } } };
    included: { relationships: { inAppPurchasePricePoint: { data: { id: string } } } }[];
  };
  assertEquals(schedule.data.relationships.baseTerritory.data.id, 'DEU');
  assertEquals(schedule.included[0].relationships.inAppPurchasePricePoint.data.id, 'pp1');
  assertEquals(
    basePricePoint([
      { id: 'a', attributes: { customerPrice: '8.99' } },
      { id: 'b', attributes: { customerPrice: '9.99' } },
    ])?.id,
    'b',
  );
  const availability = availabilityBody('iap1', ['DEU', 'AUT']) as {
    data: { attributes: { availableInNewTerritories: boolean } };
  };
  assertEquals(availability.data.attributes.availableInNewTerritories, true);
});

Deno.test('Google: the same id, listings and 9.99 EUR in Germany', () => {
  const body = oneTimeProductBody() as {
    productId: string;
    listings: { languageCode: string }[];
    purchaseOptions: {
      regionalPricingAndAvailabilityConfigs: { regionCode: string; price: unknown }[];
    }[];
  };
  assertEquals(body.productId, product.id);
  assertEquals(body.listings.map((l) => l.languageCode), ['de-DE', 'en-US']);
  assertEquals(body.purchaseOptions[0].regionalPricingAndAvailabilityConfigs[0], {
    regionCode: 'DE',
    price: { currencyCode: 'EUR', units: '9', nanos: 990_000_000 },
    availability: 'AVAILABLE',
  } as never);
  assertEquals(money('10', 'CHF'), { currencyCode: 'CHF', units: '10', nanos: 0 });
});
