-- Job 50 (Spec #4 AC7): households a locked integration refused, per Berlin week, and how many of
-- them bought Hummlist Premium within 14 days (14 * 24 h) after their first refusal that week.
-- integration_blocked comes from the edge functions at most once an hour per household and
-- integration, only for a caller whose analytics answer is yes, so the counts are lower bounds; a
-- household counts once per week overall and once per integration. A purchase the store refunded
-- since (same transaction_ref) does not count, as in paying_households_d35.sql. Tester households
-- and internal installs leave with the internal filter. metrics.ts blockedHouseholdsByWeek().
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
      toString(properties.integration) AS integration,
      toString(properties.transaction_ref) AS ref
    FROM events
    WHERE event IN ('integration_blocked', 'purchase_completed')
      AND properties.household_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  ),
  blocked AS (
    SELECT household, toStartOfWeek(toTimeZone(timestamp, 'Europe/Berlin'), 1) AS week,
      min(timestamp) AS first_at,
      max(integration = 'siri') AS siri, max(integration = 'alexa') AS alexa,
      max(integration = 'mcp') AS mcp
    FROM household_events
    WHERE event = 'integration_blocked'
    GROUP BY household, week
  ),
  paid AS (
    SELECT household, timestamp AS paid_at
    FROM household_events
    WHERE event = 'purchase_completed' AND ifNull(ref, '') NOT IN (SELECT ref FROM refunded)
  ),
  converted AS (
    SELECT b.household AS household, b.week AS week
    FROM blocked AS b
    INNER JOIN paid AS p ON p.household = b.household
    WHERE p.paid_at >= b.first_at AND p.paid_at <= b.first_at + INTERVAL 14 DAY
    GROUP BY b.household, b.week
  )
SELECT
  b.week AS week,
  count() AS households,
  countIf(b.siri) AS siri,
  countIf(b.alexa) AS alexa,
  countIf(b.mcp) AS mcp,
  countIf(c.household != '') AS paying_within_14_days
FROM blocked AS b
LEFT JOIN converted AS c ON c.household = b.household AND c.week = b.week
GROUP BY week
ORDER BY week
