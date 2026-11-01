import { assertEquals } from 'jsr:@std/assert@^1';
import {
  lifetimeProductId,
  playBasePlanId,
  productOf,
  yearlyProductId,
} from '../../supabase/functions/purchases/types.ts';
import {
  availabilityBody,
  basePricePoint,
  createProductBody,
  priceScheduleBody,
} from './apple_product.ts';
import { oneTimeProductBody } from './google_product.ts';
import { lifetime, money, product, subscriptionGroup, yearly } from './product.ts';

Deno.test('the products are the ones the purchases function sells, both as premium', () => {
  assertEquals([yearly.id, lifetime.id, yearly.playBasePlanId], [
    yearlyProductId,
    lifetimeProductId,
    playBasePlanId,
  ]);
  assertEquals(product, lifetime);
  const premium = (id: string, plan: string) => ({ id, kind: 'premium', plan });
  assertEquals(productOf(yearly.id), premium(yearly.id, 'yearly'));
  assertEquals(productOf(`${yearly.id}:${yearly.playBasePlanId}`), premium(yearly.id, 'yearly'));
  assertEquals(productOf(lifetime.id), premium(lifetime.id, 'lifetime'));
  assertEquals(productOf(`${yearly.id}:monthly`), null);
  assertEquals(productOf('com.hummlist.app.plus'), null);
  assertEquals(productOf('toString'), null);
});

interface Localization {
  displayName: string;
  description: string;
  locale: string;
}
const storekitListings = (ls: Localization[]) =>
  ls.map((l) => [l.locale, l.displayName, l.description]);
const listings = (p: typeof yearly | typeof lifetime) =>
  p.listings.map((l) => [l.apple === 'de-DE' ? 'de' : 'en_US', l.name, l.description]);

Deno.test('the StoreKit configuration file mirrors both products', async () => {
  const storekit = JSON.parse(
    await Deno.readTextFile(new URL('../../app/ios/Hummlist.storekit', import.meta.url)),
  );
  assertEquals(storekit.version.major, 4);
  assertEquals(storekit.settings._storefront, lifetime.basePrice.territory);

  assertEquals(storekit.products.length, 1);
  const [p] = storekit.products;
  assertEquals(
    [p.productID, p.internalID, p.type, p.displayPrice, p.familyShareable, p.referenceName],
    [
      lifetime.id,
      lifetime.appleId,
      'NonConsumable',
      lifetime.basePrice.amount,
      false,
      lifetime.referenceName,
    ],
  );
  assertEquals(storekitListings(p.localizations), listings(lifetime));

  assertEquals(storekit.subscriptionGroups.length, 1);
  const [group] = storekit.subscriptionGroups;
  assertEquals([group.id, group.name, group.subscriptions.length], [
    subscriptionGroup.appleId,
    subscriptionGroup.name,
    1,
  ]);
  const [s] = group.subscriptions;
  assertEquals(
    [
      s.productID,
      s.internalID,
      s.type,
      s.displayPrice,
      s.familyShareable,
      s.referenceName,
      s.recurringSubscriptionPeriod,
      s.subscriptionGroupID,
      s.groupNumber,
      s.introductoryOffer,
    ],
    [
      yearly.id,
      yearly.appleId,
      'RecurringSubscription',
      yearly.basePrice.amount,
      false,
      yearly.referenceName,
      yearly.period,
      subscriptionGroup.appleId,
      1,
      null,
    ],
  );
  assertEquals(storekitListings(s.localizations), listings(yearly));
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
      { id: 'b', attributes: { customerPrice: '29.99' } },
    ])?.id,
    'b',
  );
  const availability = availabilityBody('iap1', ['DEU', 'AUT']) as {
    data: { attributes: { availableInNewTerritories: boolean } };
  };
  assertEquals(availability.data.attributes.availableInNewTerritories, true);
});

Deno.test('Google: the same id, listings and 29.99 EUR in Germany', () => {
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
    price: { currencyCode: 'EUR', units: '29', nanos: 990_000_000 },
    availability: 'AVAILABLE',
  } as never);
  assertEquals(money('10', 'CHF'), { currencyCode: 'CHF', units: '10', nanos: 0 });
});
