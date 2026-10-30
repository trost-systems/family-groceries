// Hummlist Lifetime as the stores sell it (docs/PURCHASES.md, "Store setup"). One place for the
// product's id, names and base price; apple_product.ts and google_product.ts create it from here,
// app/ios/Hummlist.storekit mirrors it (product_test.ts keeps them in step).

export const product = {
  id: 'com.hummlist.app.lifetime',
  /** App Store Connect's reference name (never shown to buyers). */
  referenceName: 'Hummlist Lifetime',
  /** Base price in the base territory; the stores equalize every other territory from it. */
  basePrice: { territory: 'DEU', region: 'DE', currency: 'EUR', amount: '9.99' },
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

/** "9.99" as Google's Money: units and nanos. */
export function money(amount: string, currencyCode: string) {
  const [units, fraction = ''] = amount.split('.');
  return { currencyCode, units, nanos: Number(fraction.padEnd(9, '0').slice(0, 9)) };
}
