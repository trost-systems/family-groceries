// The public REST API for one household's list: /functions/v1/api/v1/... (docs/API.md).
import { withTelemetry } from '../_shared/telemetry.ts';
import { handle } from './handler.ts';
import { telemetry } from './telemetry.ts';

Deno.serve(withTelemetry('api', (req) => handle(req), telemetry));
