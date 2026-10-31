// Sample events for metrics_test.ts, shaped like PostHog's export (event, timestamp in UTC,
// properties). A small month of four customer households plus the cases the gate insights must
// get right: Berlin week edges, a purchase after day 35, a refund in the next month, a restore,
// an install marked internal late, a test account and Peter's household. payingEvents (job 43)
// adds households in January 2027 for the paying-household gate.
import type { Event } from './metrics.ts';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const household = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const I1 = id(1), I2 = id(2), I3 = id(3), I4 = id(4), I5 = id(5), I6 = id(6), I7 = id(7);
export const I8 = id(8), H8 = household(8);
export const H1 = household(1),
  H2 = household(2),
  H4 = household(4),
  H5 = household(5),
  H6 = household(6),
  HP = household(99);
export const H10 = household(10),
  H11 = household(11),
  H12 = household(12),
  H13 = household(13),
  H14 = household(14),
  H15 = household(15);

function ev(
  event: string,
  timestamp: string,
  install: string,
  householdId: string | null,
  extra: Record<string, unknown> = {},
  internal = false,
): Event {
  return {
    event,
    timestamp,
    properties: {
      distinct_id: install,
      install_id: install,
      household_id: householdId,
      platform: 'ios',
      app_version: '0.2.0+1100',
      is_internal: internal,
      $geoip_disable: true,
      ...extra,
    },
  };
}

const lifetime = (ref: string) => ({
  product_id: 'com.hummlist.app.lifetime',
  price: 9.99,
  currency: 'EUR',
  app_store: 'apple',
  country: 'DE',
  net_amount: 7.14,
  transaction_ref: ref.repeat(32),
});

export const events: Event[] = [
  // H1: first open at 00:10 on Monday 2 Nov in Berlin (still Sunday in UTC).
  ev('first_open', '2026-11-01T23:10:00Z', I1, null),
  ev('household_created', '2026-11-01T23:12:00Z', I1, H1),
  ev('item_added', '2026-11-01T23:15:00Z', I1, H1, { source: 'typed' }),
  ev('item_ticked', '2026-11-05T10:00:00Z', I1, H1, { actor_role: 'owner', household_size: 1 }),
  ev('purchase_completed', '2026-11-20T10:00:00Z', I1, H1, lifetime('a')),
  ev('category_reordered', '2026-11-06T10:00:00Z', I1, H1, { scope: 'default' }),
  ev('category_reordered', '2026-11-07T10:00:00Z', I1, H1, { scope: 'default' }),
  ev('category_reordered', '2026-11-07T11:00:00Z', I1, H1, { scope: 'store' }),
  ev('store_reordered', '2026-11-07T12:00:00Z', I1, H1),
  // Day 31 after H1 started: month 1, week 4.
  ev('item_added', '2026-12-03T10:00:00Z', I1, H1, { source: 'spoken' }),

  // H2: buys on day 46, too late for the day-35 gate.
  ev('first_open', '2026-11-04T09:00:00Z', I2, null),
  ev('household_created', '2026-11-04T09:01:00Z', I2, H2),
  ev('item_added', '2026-11-04T09:02:00Z', I2, H2, { source: 'suggestion' }),
  // 00:30 on Monday 9 Nov in Berlin: the next week.
  ev('item_ticked', '2026-11-08T23:30:00Z', I2, H2),
  ev('purchase_completed', '2026-12-20T10:00:00Z', I2, H2, lifetime('b')),

  // H2's second member: joins by link, buys in time, but the store refunds it in December.
  ev('first_open', '2026-11-05T12:00:00Z', I3, null),
  ev('invite_accepted', '2026-11-05T12:01:00Z', I3, H2, { method: 'link' }),
  ev('item_ticked', '2026-11-06T08:00:00Z', I3, H2),
  ev('purchase_completed', '2026-11-25T10:00:00Z', I3, H2, lifetime('c')),
  ev('purchase_refunded', '2026-12-02T10:00:00Z', I3, H2, lifetime('c')),

  // H4: one add, then quiet; restores a purchase from an earlier install (no revenue).
  ev('first_open', '2026-11-09T10:00:00Z', I4, null),
  ev('household_created', '2026-11-09T10:01:00Z', I4, H4),
  ev('item_added', '2026-11-09T10:05:00Z', I4, H4, { source: 'typed' }),
  ev('purchase_restored', '2026-11-10T10:00:00Z', I4, H4, {
    product_id: 'com.hummlist.app.lifetime',
    app_store: 'apple',
  }),

  // H5: looks like a customer until its phone is marked internal under More.
  ev('first_open', '2026-11-03T10:00:00Z', I5, null),
  ev('household_created', '2026-11-03T10:01:00Z', I5, H5),
  ev('item_added', '2026-11-03T10:02:00Z', I5, H5, { source: 'typed' }),
  ev('item_ticked', '2026-11-06T10:00:00Z', I5, H5, {}, true),

  // A test account (internal from the start), with a purchase that must not count.
  ev('first_open', '2026-11-02T10:00:00Z', I6, null, {}, true),
  ev('household_created', '2026-11-02T10:01:00Z', I6, H6, {}, true),
  ev('item_added', '2026-11-02T10:02:00Z', I6, H6, { source: 'typed' }, true),
  ev('purchase_completed', '2026-11-03T10:00:00Z', I6, H6, lifetime('d'), true),

  // Job 25: a TestFlight tester's household. Its sandbox purchase reaches PostHog with
  // is_internal (purchases/handler.ts), which takes the whole household out, the add included.
  ev('first_open', '2026-11-05T09:00:00Z', I8, null),
  ev('household_created', '2026-11-05T09:01:00Z', I8, H8),
  ev('item_added', '2026-11-05T09:02:00Z', I8, H8, { source: 'typed' }),
  ev('purchase_completed', '2026-11-06T09:00:00Z', I8, H8, lifetime('e'), true),

  // Peter's household, listed internal.
  ev('item_added', '2026-11-04T10:00:00Z', I7, HP, { source: 'typed' }, true),
  ev('category_reordered', '2026-11-04T11:00:00Z', I7, HP, { scope: 'store' }, true),
];

// Job 43, the paying-household gate (paying_households_d35.sql, paying_share_wah.sql). Its own
// weeks from Monday 4 January 2027, so the month above keeps its numbers. 2027-01-04 is a Monday.
export const payingEvents: Event[] = [
  // H10: both members buy. The household counts once.
  ev('first_open', '2027-01-04T09:00:00Z', id(10), null),
  ev('household_created', '2027-01-04T09:01:00Z', id(10), H10),
  ev('item_added', '2027-01-04T09:02:00Z', id(10), H10, { source: 'typed' }),
  ev('purchase_completed', '2027-01-06T10:00:00Z', id(10), H10, lifetime('f')),
  ev('first_open', '2027-01-05T09:00:00Z', id(11), null),
  ev('invite_accepted', '2027-01-05T09:01:00Z', id(11), H10, { method: 'code' }),
  ev('purchase_completed', '2027-01-07T10:00:00Z', id(11), H10, lifetime('g')),
  ev('item_added', '2027-01-13T10:00:00Z', id(10), H10, { source: 'typed' }),

  // H11: buys, then the store refunds it two weeks later. Never paying, not even in the week
  // it bought (a refund counts back to the purchase).
  ev('first_open', '2027-01-05T10:00:00Z', id(12), null),
  ev('household_created', '2027-01-05T10:01:00Z', id(12), H11),
  ev('item_added', '2027-01-05T10:02:00Z', id(12), H11, { source: 'typed' }),
  ev('purchase_completed', '2027-01-06T10:00:00Z', id(12), H11, lifetime('h')),
  ev('purchase_refunded', '2027-01-20T10:00:00Z', id(12), H11, lifetime('h')),

  // H12: a tester household. The server's tester grant unlocks it without a purchase, and from
  // then on the app marks the household's events is_internal. Its first event came before the
  // grant reached the app; it goes too, from both numerator and denominator.
  ev('first_open', '2027-01-05T11:00:00Z', id(13), null),
  ev('household_created', '2027-01-05T11:01:00Z', id(13), H12),
  ev('item_added', '2027-01-05T11:05:00Z', id(13), H12, { source: 'typed' }, true),

  // H13: active from the start, buys on day 40 (Saturday 13 Feb, week of 8 Feb): too late for
  // day 35, not paying in the week of 11 Jan, paying when it adds again in the week of 15 Feb.
  ev('first_open', '2027-01-04T08:00:00Z', id(14), null),
  ev('household_created', '2027-01-04T08:00:00Z', id(14), H13),
  ev('item_added', '2027-01-04T08:01:00Z', id(14), H13, { source: 'typed' }),
  ev('item_ticked', '2027-01-12T08:00:00Z', id(14), H13),
  ev('purchase_completed', '2027-02-13T10:00:00Z', id(14), H13, lifetime('i')),
  ev('item_added', '2027-02-16T10:00:00Z', id(14), H13, { source: 'typed' }),

  // H14: buys at 23:30 UTC on Sunday 10 Jan, which is 00:30 on Monday 11 Jan in Berlin. Not
  // paying in the week of 4 Jan, paying in the week of 11 Jan.
  ev('first_open', '2027-01-06T10:00:00Z', id(15), null),
  ev('household_created', '2027-01-06T10:01:00Z', id(15), H14),
  ev('item_added', '2027-01-06T10:02:00Z', id(15), H14, { source: 'typed' }),
  ev('purchase_completed', '2027-01-10T23:30:00Z', id(15), H14, lifetime('j')),
  ev('item_ticked', '2027-01-12T10:00:00Z', id(15), H14),

  // H15: the second member bought Hummlist Lifetime but declined analytics, so the purchases
  // function sent no purchase_completed. The household is active and never paying: the known
  // undercount (docs/ANALYTICS.md), why the share is a lower bound.
  ev('first_open', '2027-01-05T12:00:00Z', id(16), null),
  ev('household_created', '2027-01-05T12:01:00Z', id(16), H15),
  ev('item_added', '2027-01-05T12:02:00Z', id(16), H15, { source: 'typed' }),
];
