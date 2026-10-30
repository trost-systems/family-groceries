-- AC8: unlock revenue per Berlin month and currency. Sandbox purchases (TestFlight, Apple sandbox
-- testers, Play license testers) arrive with is_internal = true from the purchases function (job
-- 25), so the internal filter below drops them with the rest of their household.
-- Completed purchases add, refunds subtract in the month the refund happened, restores add
-- nothing. net = after VAT and the store fee, as the edge function estimates it (purchases.ts);
-- the stores' monthly financial reports are the real proceeds. metrics.ts revenueByMonth().
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
  purchases AS (
    SELECT
      event,
      toStartOfMonth(toTimeZone(timestamp, 'Europe/Berlin')) AS month,
      ifNull(toString(properties.currency), '') AS currency,
      ifNull(toFloat(properties.price), 0) AS price,
      ifNull(toFloat(properties.net_amount), 0) AS net_amount,
      multiIf(event = 'purchase_completed', 1, event = 'purchase_refunded', -1, 0) AS sign
    FROM events
    WHERE event IN ('purchase_completed', 'purchase_refunded', 'purchase_restored')
    AND ifNull(toString(properties.is_internal), '') != 'true'
    AND ifNull(toString(properties.install_id), '') NOT IN (SELECT id FROM internal_installs)
    AND ifNull(toString(properties.household_id), '') NOT IN (SELECT id FROM internal_households)
  )
SELECT
  month,
  currency,
  countIf(event = 'purchase_completed') AS purchases,
  countIf(event = 'purchase_refunded') AS refunds,
  countIf(event = 'purchase_restored') AS restores,
  round(sum(sign * price), 2) AS gross_revenue,
  round(sum(sign * net_amount), 2) AS net_revenue
FROM purchases
GROUP BY month, currency
ORDER BY month, currency
