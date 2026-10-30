-- AC4: what PostHog holds, checked against the allow-list (docs/ANALYTICS.md, "Event catalog").
-- Run each block after the first real events (the lead, via the connector). Every result should
-- be empty except where noted.

-- 1. Property keys outside the allow-list, with how often they occur. PostHog adds a few keys at
--    ingestion ($lib is ours; $sent_at etc. may appear): judge each one listed.
SELECT key, count() AS events
FROM events
ARRAY JOIN JSONExtractKeys(properties) AS key
WHERE timestamp > now() - INTERVAL 90 DAY
  AND key NOT IN (
    'distinct_id', 'event_id', 'install_id', 'household_id', 'platform', 'app_version',
    'is_internal', '$geoip_disable', '$process_person_profile', '$lib', '$lib_version',
    '$groups', 'source', 'actor_role', 'household_size', 'scope', 'method',
    'product_id', 'price', 'currency', 'app_store', 'country', 'net_amount', 'transaction_ref',
    'function_name', '$exception_list', '$exception_level'
  )
GROUP BY key
ORDER BY events DESC;

-- 2. IP addresses and GeoIP properties: must be zero rows.
SELECT event, count() AS events
FROM events
WHERE timestamp > now() - INTERVAL 90 DAY
  AND (properties.$ip IS NOT NULL
    OR properties.$geoip_country_code IS NOT NULL
    OR properties.$geoip_city_name IS NOT NULL
    OR toString(properties.$geoip_disable) != 'true')
GROUP BY event;

-- 3. Anything shaped like an e-mail address anywhere in the properties: must be zero rows.
SELECT event, count() AS events
FROM events
WHERE timestamp > now() - INTERVAL 90 DAY
  AND match(toString(properties), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}')
GROUP BY event;

-- 4. Every distinct value of the text properties: only the allowed words, versions and ids.
SELECT 'source' AS property, toString(properties.source) AS value, count() AS events
FROM events WHERE event = 'item_added' GROUP BY value
UNION ALL
SELECT 'scope', toString(properties.scope), count() FROM events
WHERE event = 'category_reordered' GROUP BY toString(properties.scope)
UNION ALL
SELECT 'method', toString(properties.method), count() FROM events
WHERE event = 'invite_accepted' GROUP BY toString(properties.method)
UNION ALL
SELECT 'platform', toString(properties.platform), count() FROM events
GROUP BY toString(properties.platform)
UNION ALL
SELECT 'app_version', toString(properties.app_version), count() FROM events
GROUP BY toString(properties.app_version)
UNION ALL
SELECT 'actor_role', toString(properties.actor_role), count() FROM events
WHERE event IN ('item_added', 'item_ticked') GROUP BY toString(properties.actor_role);

-- 5. Error messages: every distinct exception type and value. Values are scrubbed (quoted text,
--    e-mails, URLs, UUIDs, long numbers replaced; non-runtime errors keep only a code); read
--    them for anything that still looks like list text or a name.
SELECT
  JSONExtractString(arrayJoin(JSONExtractArrayRaw(toString(properties.$exception_list))), 'type') AS type,
  JSONExtractString(arrayJoin(JSONExtractArrayRaw(toString(properties.$exception_list))), 'value') AS value,
  count() AS events
FROM events
WHERE event = '$exception'
GROUP BY type, value
ORDER BY events DESC;
