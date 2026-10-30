// AC10: an add over Alexa is counted like an add in the app, as item_added with source alexa, once
// per item that was not on the list yet, and only for a user whose newest answer in the app was
// yes (analytics_consents). Never a name: the catalog in telemetry.ts allows nothing else.
import type { Telemetry } from '../_shared/telemetry.ts';
import type { Added } from '../voice/handler.ts';
import type { AnalyticsSubject } from './store.ts';

/** Queues the events; returns how many. */
export function countAdds(
  telemetry: Telemetry,
  subject: AnalyticsSubject | null,
  added: readonly Added[],
): number {
  if (!subject) return 0;
  let queued = 0;
  for (const _ of added.filter((a) => !a.alreadyOnList)) {
    const ok = telemetry.event(
      'item_added',
      {
        installId: subject.installId,
        householdId: subject.householdId,
        internal: subject.internal,
      },
      { source: 'alexa', actor_role: subject.role, household_size: subject.householdSize },
    );
    if (ok) queued++;
  }
  return queued;
}
