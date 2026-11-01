-- Jobs 43 and 49, the kill gate: per Berlin week, the weekly active households (exactly wah.sql:
-- an add or a tick that week) and how many of them have Hummlist Premium in that week. Premium
-- comes from a purchase_completed for the household, Lifetime or Yearly. Lifetime (premium_source
-- 'lifetime', or none: events before job 49) counts in every week from the purchase's week on.
-- Yearly (premium_source 'yearly' or the yearly product_id) counts from the purchase's week through
-- the week that contains the purchase + 379 days (a year and 14 days' grace): renewals send no
-- event and there is no expiry event, so this approximation misses renewals after year one and
-- counts a subscription cancelled within its first year to the end of that year
-- (docs/ANALYTICS.md). A purchase the store refunded (same transaction_ref, any time) does not
-- count; the household's other purchases still do, and several count once. A buyer without
-- analytics consent sends no purchase_completed, so the share is a lower bound. Tester households
-- and Sandbox purchases send is_internal = true and leave with the internal filter. Gate:
-- share_percent >= 2 in the Berlin week that contains day 35 after launch. The y.household check
-- covers default-value outer joins. metrics.ts payingShareOfWah().
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
      timestamp,
      toString(properties.transaction_ref) AS ref,
      ifNull(toString(properties.premium_source), '') = 'yearly'
        OR ifNull(toString(properties.product_id), '') = 'com.hummlist.app.yearly' AS yearly
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
    SELECT
      household,
      week AS from_week,
      yearly,
      toStartOfWeek(toTimeZone(timestamp + INTERVAL 379 DAY, 'Europe/Berlin'), 1) AS yearly_until
    FROM household_events
    WHERE event = 'purchase_completed' AND ifNull(ref, '') NOT IN (SELECT ref FROM refunded)
  ),
  paying AS (
    SELECT DISTINCT a.household AS household, a.week AS week
    FROM active AS a
    INNER JOIN paid AS p ON p.household = a.household
    WHERE p.from_week <= a.week AND (NOT p.yearly OR a.week <= p.yearly_until)
  )
SELECT
  a.week AS week,
  count() AS wah,
  countIf(y.household != '') AS paying,
  round(100 * paying / wah, 1) AS share_percent
FROM active AS a
LEFT JOIN paying AS y ON y.household = a.household AND y.week = a.week
GROUP BY week
ORDER BY week
