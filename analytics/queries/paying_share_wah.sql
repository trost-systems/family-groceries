-- Job 43, the kill gate: per Berlin week, the weekly active households (exactly wah.sql: an add
-- or a tick that week) and how many of them have Hummlist Lifetime by the week's end: a
-- purchase_completed for the household in that week or before. A purchase the store refunded
-- (same transaction_ref, any time) does not count; a second purchase in the same household counts
-- once. A buyer without analytics consent sends no purchase_completed, so the share is a lower
-- bound. Tester households and Sandbox purchases send is_internal = true and leave with the
-- internal filter. Gate: share_percent >= 2 in the Berlin week that contains day 35 after launch.
-- The p.household check covers default-value outer joins. metrics.ts payingShareOfWah().
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
    SELECT
      toString(properties.household_id) AS household,
      event,
      toStartOfWeek(toTimeZone(timestamp, 'Europe/Berlin'), 1) AS week,
      toString(properties.transaction_ref) AS ref
    FROM events
    WHERE event IN ('item_added', 'item_ticked', 'purchase_completed')
      AND properties.household_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  ),
  active AS (
    SELECT DISTINCT household, week
    FROM household_events
    WHERE event IN ('item_added', 'item_ticked')
  ),
  paid AS (
    SELECT household, min(week) AS paid_week
    FROM household_events
    WHERE event = 'purchase_completed' AND ifNull(ref, '') NOT IN (SELECT ref FROM refunded)
    GROUP BY household
  )
SELECT
  a.week AS week,
  count() AS wah,
  countIf(p.household != '' AND p.paid_week <= a.week) AS paying,
  round(100 * paying / wah, 1) AS share_percent
FROM active AS a
LEFT JOIN paid AS p ON p.household = a.household
GROUP BY week
ORDER BY week
