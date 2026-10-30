-- AC6: share of each install-week cohort that bought the lifetime unlock within 35 days of its
-- first_open. The install week is the Berlin week (Monday) of first_open, which the app sends at
-- the first consented sign-in on an install (docs/ANALYTICS.md). A purchase the store refunded
-- since (same transaction_ref) does not count. metrics.ts unlockByDay35().
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
  installs AS (
    SELECT
      toString(properties.install_id) AS install,
      minIf(timestamp, event = 'first_open') AS first_at,
      countIf(event = 'purchase_completed'
        AND toString(properties.transaction_ref) NOT IN (SELECT ref FROM refunded)) > 0 AS paid,
      minIf(timestamp, event = 'purchase_completed'
        AND toString(properties.transaction_ref) NOT IN (SELECT ref FROM refunded)) AS paid_at
    FROM events
    WHERE event IN ('first_open', 'purchase_completed')
      AND properties.install_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
    GROUP BY install
    HAVING countIf(event = 'first_open') > 0
  )
SELECT
  toStartOfWeek(toTimeZone(first_at, 'Europe/Berlin'), 1) AS install_week,
  count() AS installs,
  countIf(paid AND paid_at <= first_at + INTERVAL 35 DAY) AS bought_by_day_35,
  round(100 * bought_by_day_35 / installs, 1) AS share_percent
FROM installs
GROUP BY install_week
ORDER BY install_week
