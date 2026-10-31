// Readiness probe for deploy smoke tests and the keepalive: GET /functions/v1/health
// answers after one read-only Postgres query (status and body in handler.ts).
import { withTelemetry } from '../_shared/telemetry.ts';
import { handle } from './handler.ts';

Deno.serve(withTelemetry('health', (req) => handle(req)));
