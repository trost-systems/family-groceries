// Promotional grants of Hummlist Premium at RevenueCat (API v2, permission
// customer_information:customers:read_write): a tester's grant for good (scripts/iap/promotional.ts)
// and the beta's grant with a real end (beta_promo.ts, scripts/iap/beta_promo.ts). Server to
// server: RevenueCat gets the household id and the grant's end, nothing else (Legal Review N-51).
// Granting again with a later end extends a grant; it never shortens one, so a new, earlier end is
// a revoke followed by a grant.
import { type Fetch, type RevenueCatKey, revenueCatTimeoutMs, within } from './deletions.ts';
import { RevenueCatUnavailable } from './promotional.ts';

/** The premium entitlement's id in RevenueCat project proj9cb4a72e (lookup key "premium"). */
export const premiumEntitlementId = 'entl654efcfce4';

function api(key: RevenueCatKey, untimed: Fetch, timeoutMs: number) {
  const timed = within(untimed, timeoutMs);
  const fetch: Fetch = (url, init) =>
    timed(url, init).catch(() => {
      throw new RevenueCatUnavailable(null);
    });
  const project = `https://api.revenuecat.com/v2/projects/${encodeURIComponent(key.projectId)}`;
  const headers = {
    authorization: `Bearer ${key.secretKey}`,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  return { fetch, project, headers };
}

/**
 * Grants [householdId]'s RevenueCat customer the premium entitlement until [expiresAt]
 * (POST .../customers/{id}/actions/grant_entitlement). A customer RevenueCat doesn't know yet
 * (404: the household never opened the purchase screen) is created first (POST .../customers).
 * Throws [RevenueCatUnavailable] for a refusal, and when RevenueCat takes longer than [timeoutMs].
 */
export async function grantEntitlement(
  key: RevenueCatKey,
  householdId: string,
  expiresAt: Date,
  untimed: Fetch,
  timeoutMs = revenueCatTimeoutMs,
): Promise<void> {
  const { fetch, project, headers } = api(key, untimed, timeoutMs);
  const grant = () =>
    fetch(`${project}/customers/${encodeURIComponent(householdId)}/actions/grant_entitlement`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        entitlement_id: premiumEntitlementId,
        expires_at: expiresAt.getTime(),
      }),
    });
  let res = await grant();
  if (res.status === 404) {
    await res.body?.cancel();
    const created = await fetch(`${project}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: householdId }),
    });
    await created.body?.cancel();
    if (created.status !== 201 && created.status !== 200 && created.status !== 409) {
      throw new RevenueCatUnavailable(created.status);
    }
    res = await grant();
  }
  await res.body?.cancel();
  if (res.status !== 201 && res.status !== 200) throw new RevenueCatUnavailable(res.status);
}

/**
 * Revokes every active promotional grant of the premium entitlement of [householdId]'s customer
 * (POST .../actions/revoke_granted_entitlement). A customer RevenueCat doesn't know (404) has none.
 */
export async function revokeGrantedEntitlement(
  key: RevenueCatKey,
  householdId: string,
  untimed: Fetch,
  timeoutMs = revenueCatTimeoutMs,
): Promise<void> {
  const { fetch, project, headers } = api(key, untimed, timeoutMs);
  const res = await fetch(
    `${project}/customers/${encodeURIComponent(householdId)}/actions/revoke_granted_entitlement`,
    { method: 'POST', headers, body: JSON.stringify({ entitlement_id: premiumEntitlementId }) },
  );
  await res.body?.cancel();
  if (res.status !== 200 && res.status !== 404) throw new RevenueCatUnavailable(res.status);
}
