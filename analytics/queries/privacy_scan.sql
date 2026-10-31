-- AC4: what PostHog holds, checked against the allow-list (docs/ANALYTICS.md, "Event catalog").
-- Run each block after the first real events (the lead, via the connector). Every result should
-- be empty except where noted.

-- 1. Property keys outside the allow-list, with how often they occur. PostHog adds a few keys at
--    ingestion ($sent_at etc. may appear): judge each one listed. Since job 44 the SDKs add their
--    own (docs/ANALYTICS.md, "What the SDK adds"); those are listed in the second half.
SELECT key, count() AS events
FROM events
ARRAY JOIN JSONExtractKeys(properties) AS key
WHERE timestamp > now() - INTERVAL 90 DAY
  AND key NOT IN (
    -- The app's context and events (app/lib/analytics/events.dart) and the server's
    -- (supabase/functions/_shared/telemetry.ts).
    'distinct_id', 'event_id', 'install_id', 'household_id', 'platform', 'app_version',
    'is_internal', '$geoip_disable', '$process_person_profile', '$lib', '$lib_version',
    '$groups', 'source', 'actor_role', 'household_size', 'scope', 'method', 'default_stores',
    'channel', 'context', 'via', 'category', 'entry_point', 'screen', 'contact_ok',
    'product_id', 'price', 'currency', 'app_store', 'country', 'net_amount', 'transaction_ref',
    'function_name', '$exception_list', '$exception_level',
    -- posthog-js on the web, after its before_send (webSdkKeys).
    'token', '$os', '$os_version', '$browser', '$browser_version', '$browser_language',
    '$device_type', '$screen_height', '$screen_width', '$viewport_height', '$viewport_width',
    '$timezone',
    -- posthog-ios and posthog-android (no hook strips them; job 44's research).
    '$app_name', '$app_version', '$app_build', '$app_namespace', '$is_testflight',
    '$is_sideloaded', '$device_manufacturer', '$device_model', '$device_name', '$is_emulator',
    '$is_ios_running_on_mac', '$is_mac_catalyst_app', '$os_name', '$screen_density',
    '$hinge_status', '$locale', '$network_wifi', '$network_cellular', '$network_bluetooth',
    '$network_carrier', '$user_agent', '$raw_user_agent', '$session_id', '$is_identified',
    '$recording_status', '$sdk_debug_pending_queue_size', '$sdk_debug_current_session_duration',
    '$sdk_debug_session_start', '$exception_source', '$debug_images'
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
