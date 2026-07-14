UPDATE "collector_profiles"
SET "network_context" = CASE
  WHEN "network_context" ? 'mode' THEN "network_context"
  WHEN jsonb_typeof("network_context" -> 'proxy') <> 'null'
    AND "network_context" -> 'proxy' IS NOT NULL
    THEN jsonb_set("network_context", '{mode}', '"PROXY"'::jsonb, true)
  WHEN ("network_context" -> 'proxy') IS NULL
    OR jsonb_typeof("network_context" -> 'proxy') = 'null'
  THEN CASE
    WHEN "status" IN ('READY', 'BUSY') THEN
      jsonb_set(
        jsonb_set(
          "network_context",
          '{mode}',
          '"DIRECT"'::jsonb,
          true
        ),
        '{killswitch}',
        '{"enabled":false,"failClosed":false}'::jsonb,
        true
      )
    ELSE
      jsonb_set("network_context", '{mode}', '"UNCONFIGURED"'::jsonb, true)
  END
  ELSE "network_context"
END
WHERE NOT ("network_context" ? 'mode');
