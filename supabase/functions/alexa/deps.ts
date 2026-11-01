// The handler's dependencies in production: the database, the shared auth and telemetry. Kept out
// of index.ts so the database integration test runs the same wiring.
import { authenticate, AuthError } from '../_shared/auth.ts';
import { asUser, serviceDb } from '../_shared/db.ts';
import { requirePremiumWith } from '../_shared/premium.ts';
import type { Telemetry } from '../_shared/telemetry.ts';
import { addItems } from '../voice/items.ts';
import { countAdds } from './analytics.ts';
import type { Deps, Linked } from './handler.ts';
import { analyticsSubject, openItems, remember, revoke, takeAdds } from './store.ts';

/** An OAuth access token from account linking; a PAT or an app session is no link. */
export async function linkedBy(accessToken: string): Promise<Linked> {
  const auth = await authenticate(
    new Request('http://alexa.local/', { headers: { authorization: `Bearer ${accessToken}` } }),
  );
  if (auth.via !== 'oauth') throw new AuthError('invalid_token', 'Kein Alexa-Zugang.');
  return { userId: auth.userId, householdId: auth.householdId, sessionId: auth.sessionId };
}

export function productionDeps(
  telemetry: Telemetry,
  verify: Deps['verify'],
  resolve: Deps['authenticate'] = linkedBy,
): Deps {
  return {
    verify,
    authenticate: resolve,
    requirePremium: requirePremiumWith(telemetry),
    takeAdds: (linked, count) => takeAdds(serviceDb(), linked.userId, count),
    addItems: (linked, items) =>
      asUser(linked.userId, (tx) => addItems(tx, linked.householdId, items)),
    listItems: (linked) => asUser(linked.userId, (tx) => openItems(tx, linked.householdId)),
    remember: async (alexaUser, linked, relinked) => {
      await remember(serviceDb(), alexaUser, linked, relinked);
    },
    revoke: async (alexaUser) => {
      await revoke(serviceDb(), alexaUser);
    },
    counted: async (linked, added) => {
      if (!telemetry.enabled || added.every((a) => a.alreadyOnList)) return;
      countAdds(telemetry, await analyticsSubject(serviceDb(), linked.userId), added);
    },
    report: (e) => telemetry.exception(e),
  };
}
