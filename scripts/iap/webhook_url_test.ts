import { assert } from 'jsr:@std/assert@^1';
import { webhookPath } from '../../supabase/functions/purchases/types.ts';

// The webhook URL Ops registers at RevenueCat is written down in several places; each must name
// the path the function serves, pinned to Frankfurt (ADDENDUM 4 and 6, H-54).
const url = `/functions/v1${webhookPath}?forceFunctionRegion=eu-central-1`;

for (const file of ['docs/PURCHASES.md', 'docs/NEEDS_LEAD.md', 'e2e/tests/iap.ts']) {
  Deno.test(`${file} names the webhook URL the function serves`, async () => {
    const text = await Deno.readTextFile(new URL(`../../${file}`, import.meta.url));
    const literal = file.endsWith('.ts') ? url.replace('/functions/v1', '') : url;
    assert(text.includes(literal), `${file} should contain ${literal}`);
  });
}

Deno.test('the smoke check calls the webhook where the function serves it', async () => {
  const text = await Deno.readTextFile(new URL('../smoke-remote.sh', import.meta.url));
  assert(text.includes(`$fn${webhookPath}?forceFunctionRegion=eu-central-1`));
});
