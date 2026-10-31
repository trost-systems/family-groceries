-- Job 43: share of each household cohort with Hummlist Lifetime by day 35. A household starts
-- with its first event (household_created, invite_accepted, an add or a tick), as in
-- retention_weekly.sql; its cohort is the Berlin week of that start. It is paying when a
-- purchase_completed for it arrived within 35 days (35 * 24 h) of the start. A purchase the store
-- refunded since (same transaction_ref, any time) does not count; a second purchase in the same
-- household counts once. A buyer without analytics consent sends no purchase_completed, so the
-- share is a lower bound. Tester households and Sandbox purchases send is_internal = true and
-- leave with the internal filter. The cohort view of the kill gate (paying_share_wah.sql).
-- The p.household check covers default-value outer joins. metrics.ts payingHouseholdsByDay35().
WITH
  internal_installs AS (
    SELECT DISTINCT toString(properties.install_id) AS id
    FROM events
    WHERE toString(properties.is_internal) = 'true' AND properties.install_id IS NOT NULL
  ),
  internal_households AS (
    SELECT DISTINCT toString(properties.household_id) AS id
    FROM events
    WHERE toString(properties.is_internal) = 'true' AND properties.household_id IS NOT NULL
  ),
  refunded AS (
    SELECT DISTINCT toString(properties.transaction_ref) AS ref
    FROM events
    WHERE event = 'purchase_refunded'
  ),
  household_events AS (
    SELECT toString(properties.household_id) AS household, event, timestamp,
      toString(properties.transaction_ref) AS ref
    FROM events
    WHERE event IN ('household_created', 'invite_accepted', 'item_added', 'item_ticked',
        'purchase_completed')
      AND properties.household_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  ),
  starts AS (
    SELECT household, min(timestamp) AS started_at
    FROM household_events
    WHERE event != 'purchase_completed'
    GROUP BY household
  ),
  paid AS (
    SELECT household, min(timestamp) AS paid_at
    FROM household_events
    WHERE event = 'purchase_completed' AND ifNull(ref, '') NOT IN (SELECT ref FROM refunded)
    GROUP BY household
  )
SELECT
  toStartOfWeek(toTimeZone(s.started_at, 'Europe/Berlin'), 1) AS cohort_week,
  count() AS households,
  countIf(p.household != '' AND p.paid_at <= s.started_at + INTERVAL 35 DAY) AS paying_by_day_35,
  round(100 * paying_by_day_35 / households, 1) AS share_percent
FROM starts AS s
LEFT JOIN paid AS p ON p.household = s.household
GROUP BY cohort_week
ORDER BY cohort_week
