// MCP server for the shopping list: POST /functions/v1/mcp (streamable HTTP, OAuth 2.1 or PAT).
import { withTelemetry } from '../_shared/telemetry.ts';
import { handle } from './handler.ts';
import { telemetry } from './telemetry.ts';

Deno.serve(withTelemetry('mcp', (req) => handle(req), telemetry));
