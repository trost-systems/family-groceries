-- The internal filter (AC10): every install and household that ever sent is_internal = true.
-- PostHog cohorts need person profiles, which the app does not create ($process_person_profile
-- = false), so this filter is these two lists, pasted as the WITH clause of every gate query
-- (metrics.ts external()). An install marked internal late, or a tester in a household, takes
-- all of its events out, earlier ones included.
-- Run alone to see what is excluded.
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
  )
SELECT 'install' AS kind, id FROM internal_installs
UNION ALL
SELECT 'household' AS kind, id FROM internal_households
