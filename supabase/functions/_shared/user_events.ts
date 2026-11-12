// Server events about a signed-in user's request (jobs 50, 195): sent only while the user's newest
// analytics answer is a yes to the current consent text (analyticsSubject), as that install, in
// the household the request acted in. No answer, a no or an old text version: nothing is sent.
import { analyticsSubject } from '../alexa/store.ts';
import { serviceDb, type Sql } from './db.ts';
import type { Telemetry } from './telemetry.ts';

/** Queues [event] for [userId]'s consenting install; never throws. */
export type UserEvent = (
  userId: string,
  householdId: string,
  event: string,
  properties: Record<string, unknown>,
) => Promise<void>;

export function userEvents(telemetry: Telemetry, sql: () => Sql = serviceDb): UserEvent {
  return async (userId, householdId, event, properties) => {
    if (!telemetry.enabled) return;
    try {
      const subject = await analyticsSubject(sql(), userId);
      if (!subject) return;
      telemetry.event(
        event,
        { installId: subject.installId, householdId, internal: subject.internal },
        properties,
      );
    } catch (e) {
      console.error(
        `${telemetry.fn}: ${event} not recorded: ${e instanceof Error ? e.name : typeof e}`,
      );
    }
  };
}
