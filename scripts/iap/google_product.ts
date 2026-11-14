// Creates Snacklist Lifetime in Google Play through the Play Developer API (monetization.onetimeproducts,
// docs/PURCHASES.md, "Store setup"). Play only sells in-app products once the developer account has
// a payments (merchant) profile, which only Peter can create (NEEDS_PETER Job 25): before that this
// refuses to write. Dry run by default; --apply upserts the product and activates its purchase
// option, which sets the live Play price, so it also needs --confirm-price with that price
// (job 213). Idempotent (allowMissing upsert). Also prints Play's converted prices for AT and CH.
//
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH=<key file> \
//     deno run --allow-env --allow-read --allow-net scripts/iap/google_product.ts \
//     [--apply --confirm-price 149.99]
//
// The service account needs "Manage store presence" for the app (Play Console > Users and
// permissions). Prints ids and prices, never the key.
import { importPKCS8, SignJWT } from 'npm:jose@6.2.13';
import { money, product } from './product.ts';

export const packageName = 'com.snacklist.app';
const api = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
export const purchaseOptionId = 'buy';

type Json = Record<string, unknown>;

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

/** An OAuth access token for the Play Developer API (also price_drift.ts). */
export async function playAccessToken(sa: ServiceAccount, fetchFn = fetch): Promise<string> {
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(sa.token_uri)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(await importPKCS8(sa.private_key, 'RS256'));
  const tokenRes = await fetchFn(sa.token_uri, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenRes.ok) {
    await tokenRes.body?.cancel();
    throw new Error(`token: ${tokenRes.status}`);
  }
  const { access_token } = await tokenRes.json() as { access_token: string };
  return access_token;
}

/** The one-time product: DE+EN listings, one buy option priced in Germany. */
export function oneTimeProductBody(): Json {
  return {
    packageName,
    productId: product.id,
    listings: product.listings.map((l) => ({
      languageCode: l.google,
      title: l.name,
      description: l.description,
    })),
    purchaseOptions: [{
      purchaseOptionId,
      buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
      regionalPricingAndAvailabilityConfigs: [{
        regionCode: product.basePrice.region,
        price: money(product.basePrice.amount, product.basePrice.currency),
        availability: 'AVAILABLE',
      }],
    }],
  };
}

/**
 * Why --apply may not write, or null when it may: --confirm-price must name the price it sets
 * (`product.basePrice`), so a changed base price never reaches Play unseen.
 */
export function applyRefusal(
  args: string[],
  price: { amount: string; currency: string } = product.basePrice,
): string | null {
  if (!args.includes('--apply')) return null;
  const flag = args.findIndex((a) => a === '--confirm-price' || a.startsWith('--confirm-price='));
  const given = flag === -1 ? undefined : args[flag]?.split('=')[1] ?? args[flag + 1];
  const expected = `${price.amount} ${price.currency}`;
  if (given === undefined || !/^\d+(\.\d+)?$/.test(given)) {
    return `--apply sets the live Play price to ${expected}: add --confirm-price ${price.amount}`;
  }
  const a = money(given, price.currency);
  const b = money(price.amount, price.currency);
  return a.units === b.units && a.nanos === b.nanos
    ? null
    : `--confirm-price ${given} is not the base price ${expected}; nothing written`;
}

async function main() {
  const apply = Deno.args.includes('--apply');
  const refusal = applyRefusal(Deno.args);
  if (refusal) {
    console.error(refusal);
    Deno.exit(2);
  }
  const path = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH');
  if (!path) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH is not set');
  const access_token = await playAccessToken(
    JSON.parse(await Deno.readTextFile(path)) as ServiceAccount,
  );
  const call = async (method: string, url: string, body?: Json) => {
    const res = await fetch(`${api}${url}`, {
      method,
      headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${text.slice(0, 800)}`);
    return text ? JSON.parse(text) as Json : {};
  };

  const converted = await call(
    'POST',
    `/applications/${packageName}/pricing:convertRegionPrices`,
    { price: money(product.basePrice.amount, product.basePrice.currency) },
  ) as {
    convertedRegionPrices?: Record<
      string,
      { price: { units: string; nanos?: number; currencyCode: string } }
    >;
  };
  for (const region of ['AT', 'CH']) {
    const p = converted.convertedRegionPrices?.[region]?.price;
    if (p) {
      console.log(
        `converted price ${region}: ${p.units}.${
          String((p.nanos ?? 0) / 1e7).padStart(2, '0')
        } ${p.currencyCode}`,
      );
    }
  }

  const productPath = `/applications/${packageName}/onetimeproducts/${product.id}`;
  if (!apply) {
    console.log(`would upsert: PATCH ${productPath}?allowMissing=true`);
    console.log(`would activate purchase option "${purchaseOptionId}"`);
    return;
  }
  await call(
    'PATCH',
    `${productPath}?allowMissing=true&updateMask=listings,purchaseOptions&regionsVersion.version=2022/02`,
    oneTimeProductBody(),
  );
  console.log('product upserted');
  await call('POST', `${productPath}/purchaseOptions:batchUpdateStates`, {
    requests: [{
      activatePurchaseOptionRequest: { packageName, productId: product.id, purchaseOptionId },
    }],
  });
  console.log('purchase option active');
}

if (import.meta.main) await main();
