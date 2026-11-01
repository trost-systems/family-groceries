// Hummlist Premium as the stores sell it (docs/PURCHASES.md, "Store setup"): a yearly subscription
// and Lifetime, both granting the RevenueCat entitlement `premium`. One place for the products'
// ids, names and base prices; apple_product.ts and google_product.ts create Lifetime from here,
// app/ios/Hummlist.storekit mirrors both (product_test.ts keeps them in step) and price_drift.ts
// checks the stores against expectedPrices.

/** The App Store subscription group that holds the yearly subscription. */
export const subscriptionGroup = { name: 'Hummlist Premium', appleId: '22532621' } as const;

export const lifetime = {
  id: 'com.hummlist.app.lifetime',
  appleId: '6829223747',
  /** App Store Connect's reference name (never shown to buyers). */
  referenceName: 'Hummlist Lifetime',
  /** Base price in the base territory; the stores equalize every other territory from it. */
  basePrice: { territory: 'DEU', region: 'DE', currency: 'EUR', amount: '29.99' },
  /** Apple Family Sharing stays off: Apple doesn't let it be turned off again (decision 3). */
  familySharable: false,
  listings: [
    {
      apple: 'de-DE',
      google: 'de-DE',
      name: 'Hummlist Lifetime',
      description: 'Ein Kauf für den ganzen Haushalt.',
    },
    {
      apple: 'en-US',
      google: 'en-US',
      name: 'Hummlist Lifetime',
      description: 'One purchase for the whole household.',
    },
  ],
} as const;

export const yearly = {
  id: 'com.hummlist.app.yearly',
  appleId: '6829293557',
  /** Play names it `<id>:<base plan id>` (supabase/functions/purchases/types.ts). */
  playBasePlanId: 'yearly',
  referenceName: 'Hummlist Premium Yearly',
  basePrice: { territory: 'DEU', region: 'DE', currency: 'EUR', amount: '9.99' },
  /** ISO 8601, as App Store Connect and StoreKit write it. No trial, no introductory offer. */
  period: 'P1Y',
  familySharable: false,
  // Placeholder copy: Hummlist Launch writes the real store listing.
  listings: [
    {
      apple: 'de-DE',
      google: 'de-DE',
      name: 'Hummlist Premium',
      description: 'Hummlist Premium für den ganzen Haushalt, ein Jahr.',
    },
    {
      apple: 'en-US',
      google: 'en-US',
      name: 'Hummlist Premium',
      description: 'Hummlist Premium for the whole household, one year.',
    },
  ],
} as const;

/** Lifetime, the one product apple_product.ts and google_product.ts create. */
export const product = lifetime;

export type Plan = 'yearly' | 'lifetime';

/** What a storefront should charge for a plan: an amount, sold at a price not yet known, or not sold. */
export type ExpectedPrice = string | null | 'not sold';

export interface Storefront {
  /** App Store Connect's territory id (ISO 3166-1 alpha-3). */
  apple: string;
  currency: string;
  yearly: ExpectedPrice;
  lifetime: ExpectedPrice;
}

const euro = (apple: string): Storefront => ({
  apple,
  currency: 'EUR',
  yearly: '9.99',
  lifetime: '29.99',
});
/** Sold, at whatever the store set: record what the store reports on the first run. */
const yearlyOnly = (apple: string, currency: string): Storefront => ({
  apple,
  currency,
  yearly: null,
  lifetime: 'not sold',
});

/**
 * The prices price_drift.ts expects the stores to charge, keyed by ISO 3166-1 alpha-2. Drift-check
 * constants only, not a display source: the app shows the store's own price string.
 */
export const expectedPrices: Readonly<Record<string, Storefront>> = {
  AT: euro('AUT'),
  BE: euro('BEL'),
  CY: euro('CYP'),
  DE: euro('DEU'),
  EE: euro('EST'),
  ES: euro('ESP'),
  FI: euro('FIN'),
  FR: euro('FRA'),
  GR: euro('GRC'),
  HR: euro('HRV'),
  IE: euro('IRL'),
  IT: euro('ITA'),
  LT: euro('LTU'),
  LU: euro('LUX'),
  LV: euro('LVA'),
  MT: euro('MLT'),
  NL: euro('NLD'),
  PT: euro('PRT'),
  SI: euro('SVN'),
  SK: euro('SVK'),
  US: { apple: 'USA', currency: 'USD', yearly: '9.99', lifetime: '29.99' },
  GB: { apple: 'GBR', currency: 'GBP', yearly: '8.99', lifetime: '24.99' },
  CH: { apple: 'CHE', currency: 'CHF', yearly: '10', lifetime: '30' },
  BR: yearlyOnly('BRA', 'BRL'),
  MX: yearlyOnly('MEX', 'MXN'),
  IN: yearlyOnly('IND', 'INR'),
};

/** "9.99" as Google's Money: units and nanos. */
export function money(amount: string, currencyCode: string) {
  const [units, fraction = ''] = amount.split('.');
  return { currencyCode, units, nanos: Number(fraction.padEnd(9, '0').slice(0, 9)) };
}
