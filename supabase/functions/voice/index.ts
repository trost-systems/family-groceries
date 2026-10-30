import { authenticate } from '../_shared/auth.ts';
import { asUser } from '../_shared/db.ts';
import { telemetryFor, withTelemetry } from '../_shared/telemetry.ts';
import { createHandler } from './handler.ts';
import { addItems } from './items.ts';

const telemetry = telemetryFor('voice');

Deno.serve(withTelemetry(
  'voice',
  createHandler({
    authenticate: (req) => authenticate(req),
    addItems: (auth, items) => asUser(auth.userId, (tx) => addItems(tx, auth.householdId, items)),
    report: (e) => telemetry.exception(e),
  }),
  telemetry,
));
