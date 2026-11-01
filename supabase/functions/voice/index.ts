import { analyticsSubject } from '../alexa/store.ts';
import { authenticate } from '../_shared/auth.ts';
import { asUser, serviceDb } from '../_shared/db.ts';
import { requirePremiumWith } from '../_shared/premium.ts';
import { telemetryFor, withTelemetry } from '../_shared/telemetry.ts';
import { listItems } from '../mcp/list.ts';
import { createHandler } from './handler.ts';
import { addItems } from './items.ts';

const telemetry = telemetryFor('voice');

Deno.serve(withTelemetry(
  'voice',
  createHandler({
    authenticate: (req) => authenticate(req, undefined, { siri: true }),
    requirePremium: requirePremiumWith(telemetry),
    addItems: (auth, items) => asUser(auth.userId, (tx) => addItems(tx, auth.householdId, items)),
    readItems: async (auth) =>
      (await asUser(auth.userId, (tx) => listItems(tx, auth.householdId, {}))).items,
    track: async (auth, { event, ...properties }) => {
      if (!telemetry.enabled) return;
      const subject = await analyticsSubject(serviceDb(), auth.userId);
      if (!subject) return;
      telemetry.event(event, subject, properties);
    },
    report: (e) => telemetry.exception(e),
  }),
  telemetry,
));
