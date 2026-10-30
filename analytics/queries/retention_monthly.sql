-- AC7 (as replaced by Peter, 2026-10-25): household retention by install-week cohort, months 0 to 11 (30-day months).
-- A household's start is its first event (household_created, invite_accepted, an add or a
-- tick); its cohort is the Berlin week of that start. It is active in period k when it added or
-- ticked between start + k*30 days and start + (k+1)*30 days. Fixed-length periods give
-- every cohort the same windows. Divide each column by households for the share. A household
-- without any add or tick counts in households only (the a.household check covers both NULL and
-- default-value outer joins).
-- metrics.ts retention(events, 30, 12).
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
  household_events AS (
    SELECT toString(properties.household_id) AS household, event, timestamp
    FROM events
    WHERE event IN ('household_created', 'invite_accepted', 'item_added', 'item_ticked')
      AND properties.household_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  ),
  starts AS (
    SELECT household, min(timestamp) AS started_at
    FROM household_events
    GROUP BY household
  ),
  activity AS (
    SELECT e.household AS household,
      intDiv(dateDiff('second', s.started_at, e.timestamp), 30 * 86400) AS period
    FROM household_events AS e
    INNER JOIN starts AS s ON s.household = e.household
    WHERE e.event IN ('item_added', 'item_ticked')
  )
SELECT
  toStartOfWeek(toTimeZone(s.started_at, 'Europe/Berlin'), 1) AS cohort_week,
  count(DISTINCT s.household) AS households,
  count(DISTINCT if(a.period = 0 AND a.household != '', s.household, NULL)) AS m0,
  count(DISTINCT if(a.period = 1 AND a.household != '', s.household, NULL)) AS m1,
  count(DISTINCT if(a.period = 2 AND a.household != '', s.household, NULL)) AS m2,
  count(DISTINCT if(a.period = 3 AND a.household != '', s.household, NULL)) AS m3,
  count(DISTINCT if(a.period = 4 AND a.household != '', s.household, NULL)) AS m4,
  count(DISTINCT if(a.period = 5 AND a.household != '', s.household, NULL)) AS m5,
  count(DISTINCT if(a.period = 6 AND a.household != '', s.household, NULL)) AS m6,
  count(DISTINCT if(a.period = 7 AND a.household != '', s.household, NULL)) AS m7,
  count(DISTINCT if(a.period = 8 AND a.household != '', s.household, NULL)) AS m8,
  count(DISTINCT if(a.period = 9 AND a.household != '', s.household, NULL)) AS m9,
  count(DISTINCT if(a.period = 10 AND a.household != '', s.household, NULL)) AS m10,
  count(DISTINCT if(a.period = 11 AND a.household != '', s.household, NULL)) AS m11
FROM starts AS s
LEFT JOIN activity AS a ON a.household = s.household
GROUP BY cohort_week
ORDER BY cohort_week
