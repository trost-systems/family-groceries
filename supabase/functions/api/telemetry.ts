// The api function's telemetry: errors (handler.ts, index.ts), integration_blocked (job 50)
// and api_key_used (job 195).
import { telemetryFor } from '../_shared/telemetry.ts';

export const telemetry = telemetryFor('api');
