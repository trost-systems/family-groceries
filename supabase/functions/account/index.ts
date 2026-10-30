import { authenticateSession } from '../_shared/auth.ts';
import { appleSubject, deleteAccount } from '../_shared/db.ts';
import { telemetryFor, withTelemetry } from '../_shared/telemetry.ts';
import { appleConfig, revokeAppleGrant } from './apple.ts';
import { createHandler } from './handler.ts';

const telemetry = telemetryFor('account');

Deno.serve(withTelemetry(
  'account',
  createHandler({
    authenticate: (req) => authenticateSession(req),
    appleSubject,
    revokeApple: (grant) => revokeAppleGrant(grant, appleConfig()),
    deleteAccount,
    report: (e) => telemetry.exception(e),
  }),
  telemetry,
));
