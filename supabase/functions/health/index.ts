// Readiness probe for deploy smoke tests and the keepalive: GET /functions/v1/health ->
// {"ok": true, "database": true} after one read-only Postgres query.
import { handle } from './handler.ts';

Deno.serve((req) => handle(req));
