-- AC9: manual category and store reorders per household: the route order (scope default), a
-- store's layout (scope store) and the store order. metrics.ts reordersByHousehold().
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
  reorders AS (
    SELECT toString(properties.household_id) AS household, event, toString(properties.scope) AS scope
    FROM events
    WHERE event IN ('category_reordered', 'store_reordered')
      AND properties.household_id IS NOT NULL
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  )
SELECT
  household,
  countIf(event = 'category_reordered' AND scope = 'default') AS default_order,
  countIf(event = 'category_reordered' AND scope = 'store') AS store_layout,
  countIf(event = 'store_reordered') AS store_order,
  count() AS total
FROM reorders
GROUP BY household
ORDER BY total DESC
