// Creates Hummlist Lifetime in Google Play through the Play Developer API (monetization.onetimeproducts,
// docs/PURCHASES.md, "Store setup"). Play only sells in-app products once the developer account has
// a payments (merchant) profile, which only Peter can create (NEEDS_PETER Job 25): before that this
// refuses to write. Dry run by default; --apply upserts the product and activates its purchase
// option. Idempotent (allowMissing upsert). Also prints Play's converted prices for AT and CH.
//
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH=<key file> \
//     deno run --allow-env --allow-read --allow-net scripts/iap/google_product.ts [--apply]
//
// The service account needs "Manage store presence" for the app (Play Console > Users and
// permissions). Prints ids and prices, never the key.
import { importPKCS8, SignJWT } from 'npm:jose@6.2.13';
import { money, product } from './product.ts';

export const packageName = 'com.hummlist.app';
const api = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
export const purchaseOptionId = 'buy';

type Json = Record<string, unknown>;

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

async function main() {
  const apply = Deno.args.includes('--apply');
  const path = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH');
  if (!path) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_PATH is not set');
  const sa = JSON.parse(await Deno.readTextFile(path)) as {
    client_email: string;
    private_key: string;
    token_uri: string;
  };
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(sa.token_uri)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(await importPKCS8(sa.private_key, 'RS256'));
  const tokenRes = await fetch(sa.token_uri, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenRes.ok) throw new Error(`token: ${tokenRes.status}`);
  const { access_token } = await tokenRes.json() as { access_token: string };
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
