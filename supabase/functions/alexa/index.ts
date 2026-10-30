// The Alexa skill "Hummlist": POST /functions/v1/alexa (docs/ALEXA.md).
import { telemetryFor, withTelemetry } from '../_shared/telemetry.ts';
import { trustFrom } from './config.ts';
import { productionDeps } from './deps.ts';
import { createHandler } from './handler.ts';
import { verifyRequest } from './verify.ts';

const telemetry = telemetryFor('alexa');
const trust = trustFrom(Deno.env);

Deno.serve(withTelemetry(
  'alexa',
  createHandler(productionDeps(
    telemetry,
    (headers, body) => verifyRequest(headers, body, { ...trust, now: () => new Date() }),
  )),
  telemetry,
));
