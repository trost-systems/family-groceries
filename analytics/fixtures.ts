// Sample events for metrics_test.ts, shaped like PostHog's export (event, timestamp in UTC,
// properties). A small month of four customer households plus the cases the gate insights must
// get right: Berlin week edges, a purchase after day 35, a refund in the next month, a restore,
// an install marked internal late, a test account and Peter's household.
import type { Event } from './metrics.ts';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const household = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const I1 = id(1), I2 = id(2), I3 = id(3), I4 = id(4), I5 = id(5), I6 = id(6), I7 = id(7);
export const H1 = household(1),
  H2 = household(2),
  H4 = household(4),
  H5 = household(5),
  H6 = household(6),
  HP = household(99);

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
  product_id: 'lifetime',
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
    product_id: 'lifetime',
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

  // Peter's household, listed internal.
  ev('item_added', '2026-11-04T10:00:00Z', I7, HP, { source: 'typed' }, true),
  ev('category_reordered', '2026-11-04T11:00:00Z', I7, HP, { scope: 'store' }, true),
];
