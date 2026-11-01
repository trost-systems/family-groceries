// Job 50: Siri, Alexa and MCP / AI assistants are part of Hummlist Premium (Spec #4). Every
// integration endpoint asks requirePremium once it knows the caller's household; the rule itself
// lives in Postgres (public.integration_gate: the integration_lock switch, then job 49's
// household_has_premium), never here. A locked household's first refusal of the hour per
// integration counts as integration_blocked for an install that said yes to analytics.
// A failing check throws: the endpoint answers with its transient error, never as locked and
// never by going ahead (DECISIONS "Job 50").
import { analyticsSubject } from '../alexa/store.ts';
import { serviceDb, type Sql } from './db.ts';
import type { Telemetry } from './telemetry.ts';

export type Integration = 'siri' | 'alexa' | 'mcp';

export type Access = 'open' | 'locked';

export interface Caller {
  userId: string;
  householdId: string;
}

/** Decides whether [caller]'s household may use [integration] now. */
export type RequirePremium = (caller: Caller, integration: Integration) => Promise<Access>;

export interface GateDeps {
  gate(
    householdId: string,
    integration: Integration,
  ): Promise<{ locked: boolean; report: boolean }>;
  /** Sends integration_blocked for [caller]; only called for a refusal that is reported. */
  blocked(caller: Caller, integration: Integration): Promise<void>;
}

export function premiumGate(deps: GateDeps): RequirePremium {
  return async (caller, integration) => {
    const { locked, report } = await deps.gate(caller.householdId, integration);
    if (!locked) return 'open';
    if (report) {
      await deps.blocked(caller, integration).catch((e) =>
        console.error(`premium: integration_blocked not recorded: ${(e as Error)?.name}`)
      );
    }
    return 'locked';
  };
}

export async function integrationGate(
  sql: Sql,
  householdId: string,
  integration: Integration,
): Promise<{ locked: boolean; report: boolean }> {
  const [row] = await sql<{ locked: boolean; report: boolean }[]>`
    select locked, report from public.integration_gate(${householdId}::uuid, ${integration})`;
  return row;
}

/** The production gate for a function, reporting through its [telemetry]. */
export function requirePremiumWith(
  telemetry: Telemetry,
  sql: () => Sql = serviceDb,
): RequirePremium {
  return premiumGate({
    gate: (householdId, integration) => integrationGate(sql(), householdId, integration),
    blocked: async (caller, integration) => {
      if (!telemetry.enabled) return;
      const subject = await analyticsSubject(sql(), caller.userId);
      if (!subject) return;
      telemetry.event('integration_blocked', {
        installId: subject.installId,
        householdId: caller.householdId,
        internal: subject.internal,
      }, { integration });
    },
  });
}
