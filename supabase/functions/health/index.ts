// Readiness probe for deploy smoke tests and the keepalive: GET /functions/v1/health ->
// {"ok": true, "database": true} after one read-only Postgres query.
import { withTelemetry } from '../_shared/telemetry.ts';
import { handle } from './handler.ts';

Deno.serve(withTelemetry('health', (req) => handle(req)));
