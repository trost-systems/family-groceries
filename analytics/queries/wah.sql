-- AC5: weekly active households (WAH): households with at least one add or tick in the week,
-- Monday to Sunday in Europe/Berlin, each counted once. Internal installs and households are
-- left out (internal.sql). metrics.ts weeklyActiveHouseholds().
-- For one week only, add: AND week = toDate('2026-11-02') (a Monday) to the outer WHERE.
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
  activity AS (
    SELECT
      toString(properties.household_id) AS household,
      toStartOfWeek(toTimeZone(timestamp, 'Europe/Berlin'), 1) AS week
    FROM events
    WHERE event IN ('item_added', 'item_ticked')
      AND properties.household_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  )
SELECT week, count(DISTINCT household) AS wah
FROM activity
GROUP BY week
ORDER BY week
