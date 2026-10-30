// Hummlist Lifetime purchases: /functions/v1/purchases (docs/PURCHASES.md).
import { telemetryFor, withTelemetry } from '../_shared/telemetry.ts';
import { configFrom } from './config.ts';
import { productionDeps } from './deps.ts';
import { createHandler } from './handler.ts';

const telemetry = telemetryFor('purchases');

Deno.serve(withTelemetry(
  'purchases',
  createHandler(productionDeps(configFrom(Deno.env), telemetry)),
  telemetry,
));
