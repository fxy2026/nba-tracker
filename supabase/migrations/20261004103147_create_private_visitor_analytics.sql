-- Reviewed migration candidate for nba-tracker-analytics only.
-- Project: myeffpbpdqvnoinnchjy; organization: rrbyodvdhekuvidnnofd; Free.
-- Generated from the original proposal after inspecting PostgreSQL 17.11.
-- Supabase CLI/local PostgreSQL are absent; apply through the connected
-- Supabase apply_migration API, then preserve its actual migration version.
-- Collection, credentials, hosting configuration, and legacy projects untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA visitor_analytics;
REVOKE ALL ON SCHEMA visitor_analytics FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA visitor_analytics TO service_role;

CREATE TABLE visitor_analytics.state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  collected_since timestamptz,
  last_pruned_day date
);
INSERT INTO visitor_analytics.state (singleton) VALUES (true);
CREATE TABLE visitor_analytics.daily (
  day date PRIMARY KEY,
  page_views bigint NOT NULL DEFAULT 0 CHECK (page_views BETWEEN 0 AND 50000),
  identified_page_views bigint NOT NULL DEFAULT 0 CHECK (identified_page_views BETWEEN 0 AND page_views),
  unique_browsers bigint NOT NULL DEFAULT 0 CHECK (unique_browsers BETWEEN 0 AND identified_page_views),
  limited boolean NOT NULL DEFAULT false
);
-- Event IDs are one-off retry keys only, with no path, browser ID, or timestamps.
CREATE TABLE visitor_analytics.event_ids (
  event_id uuid PRIMARY KEY,
  day date NOT NULL
);
CREATE INDEX visitor_analytics_events_day ON visitor_analytics.event_ids (day);
-- A daily, random, consented identifier's SHA-256, never an IP/UA-derived hash.
-- No event/path relationship is retained. No cross-day/browser-journey queries.
CREATE TABLE visitor_analytics.browsers (
  day date NOT NULL,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  page_views integer NOT NULL DEFAULT 0 CHECK (page_views BETWEEN 0 AND 1000),
  PRIMARY KEY (day, visitor_hash)
);
CREATE TABLE visitor_analytics.dimensions (
  day date NOT NULL REFERENCES visitor_analytics.daily (day) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('path', 'referrer', 'device')),
  key text NOT NULL CHECK (length(key) BETWEEN 1 AND 160),
  page_views bigint NOT NULL DEFAULT 0 CHECK (page_views BETWEEN 0 AND 50000),
  PRIMARY KEY (day, dimension, key)
);
ALTER TABLE visitor_analytics.state ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_analytics.daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_analytics.event_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_analytics.browsers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_analytics.dimensions ENABLE ROW LEVEL SECURITY;
-- No policies permit anon/authenticated access. Keep this schema unexposed.
REVOKE ALL ON ALL TABLES IN SCHEMA visitor_analytics FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE ON visitor_analytics.state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON visitor_analytics.daily, visitor_analytics.browsers TO service_role;
GRANT SELECT, INSERT, DELETE ON visitor_analytics.event_ids TO service_role;
GRANT SELECT, INSERT, UPDATE ON visitor_analytics.dimensions TO service_role;

CREATE FUNCTION visitor_analytics.prune() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_today date := (statement_timestamp() AT TIME ZONE 'Asia/Shanghai')::date;
BEGIN
  -- Safe when invoked concurrently by ingest and the required daily cleanup job.
  PERFORM 1 FROM visitor_analytics.state WHERE singleton = true FOR UPDATE;
  DELETE FROM visitor_analytics.event_ids WHERE day < v_today - 1;
  DELETE FROM visitor_analytics.browsers WHERE day < v_today - 1;
  DELETE FROM visitor_analytics.daily WHERE day < v_today - 89;
  UPDATE visitor_analytics.state SET last_pruned_day = v_today WHERE singleton = true;
END;
$$;
REVOKE ALL ON FUNCTION visitor_analytics.prune() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION visitor_analytics.prune() TO service_role;

CREATE FUNCTION public.visitor_analytics_collect(
  p_event_id uuid, p_path text, p_referrer text, p_device text,
  p_visitor_hash text DEFAULT NULL, p_identity_day date DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_day date := (statement_timestamp() AT TIME ZONE 'Asia/Shanghai')::date;
  v_pv bigint;
  v_inserted integer;
  v_browser_new integer := 0;
  v_browser_pv integer;
  v_hash text;
  v_last_pruned_day date;
BEGIN
  IF p_event_id IS NULL OR p_event_id::text !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR p_path IS NULL OR NOT (p_path = ANY (ARRAY[
      '/', '/about', '/all-time-leaders', '/awards-race', '/back-to-back', '/best-games', '/best-of-night',
      '/by-college', '/by-country', '/by-position', '/calendar', '/clutch-teams', '/clutch', '/compare',
      '/conference-race', '/divisions', '/draft-classes', '/draft/2026', '/explore', '/favorites', '/game-predictor',
      '/glossary', '/h2h', '/history', '/home-vs-road', '/iconic-games', '/iconic-seasons', '/injuries',
      '/lab/career-arc', '/lab/explore', '/lab/game-impact', '/lab', '/lab/team-trajectory', '/milestones',
      '/momentum', '/news', '/power-rankings', '/quiz', '/records', '/rivalries', '/rookie-watch',
      '/schedule-heatmap', '/schedule', '/scoring-output', '/search', '/season/2025-26', '/shot-archive',
      '/standings', '/stats', '/streaks', '/team-stats', '/this-day', '/tier-list', '/transactions',
      '/game/[id]', '/player/[id]/gamelog', '/player/[id]', '/legends/[id]', '/team/[tricode]',
      '/series/[id]', '/iconic-games/[decade]', '/iconic-seasons/[decade]'
    ]))
    OR p_referrer IS NULL OR p_referrer NOT IN ('direct', 'internal', 'google', 'baidu', 'bing', 'duckduckgo', 'social', 'other')
    OR p_device IS NULL OR p_device NOT IN ('mobile', 'tablet', 'desktop', 'unknown')
    OR (p_visitor_hash IS NOT NULL AND p_visitor_hash !~ '^[a-f0-9]{64}$')
  THEN RAISE EXCEPTION 'Invalid analytics event'; END IF;

  -- All mutation paths lock state first, then a daily row. This avoids the
  -- original opposite lock order between pruning and ingestion across midnight.
  SELECT last_pruned_day INTO STRICT v_last_pruned_day
  FROM visitor_analytics.state WHERE singleton = true FOR UPDATE;
  IF v_last_pruned_day IS NULL OR v_last_pruned_day < v_day THEN
    PERFORM visitor_analytics.prune();
  END IF;
  -- The daily row lock serializes quota checks and all counter updates across
  -- server instances. No process-local Map/file is a source of truth.
  INSERT INTO visitor_analytics.daily (day) VALUES (v_day) ON CONFLICT DO NOTHING;
  SELECT page_views INTO v_pv FROM visitor_analytics.daily WHERE day = v_day FOR UPDATE;
  IF EXISTS (SELECT 1 FROM visitor_analytics.event_ids WHERE event_id = p_event_id) THEN RETURN 'duplicate'; END IF;
  IF v_pv >= 50000 THEN
    UPDATE visitor_analytics.daily SET limited = true WHERE day = v_day AND limited = false;
    RETURN 'limited';
  END IF;
  -- Mismatched dates are downgraded to anonymous PV, never carried over midnight.
  v_hash := CASE WHEN p_identity_day = v_day THEN p_visitor_hash ELSE NULL END;
  IF v_hash IS NOT NULL THEN
    SELECT page_views INTO v_browser_pv FROM visitor_analytics.browsers WHERE day = v_day AND visitor_hash = v_hash;
    IF v_browser_pv >= 1000 THEN
      UPDATE visitor_analytics.daily SET limited = true WHERE day = v_day AND limited = false;
      RETURN 'limited';
    END IF;
  END IF;
  INSERT INTO visitor_analytics.event_ids (event_id, day) VALUES (p_event_id, v_day) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN 'duplicate'; END IF;
  IF v_hash IS NOT NULL THEN
    INSERT INTO visitor_analytics.browsers (day, visitor_hash) VALUES (v_day, v_hash) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_browser_new = ROW_COUNT;
    UPDATE visitor_analytics.browsers SET page_views = page_views + 1 WHERE day = v_day AND visitor_hash = v_hash;
  END IF;
  UPDATE visitor_analytics.daily SET page_views = page_views + 1,
    identified_page_views = identified_page_views + CASE WHEN v_hash IS NULL THEN 0 ELSE 1 END,
    unique_browsers = unique_browsers + v_browser_new WHERE day = v_day;
  INSERT INTO visitor_analytics.dimensions (day, dimension, key, page_views) VALUES
    (v_day, 'path', p_path, 1), (v_day, 'referrer', p_referrer, 1), (v_day, 'device', p_device, 1)
    ON CONFLICT (day, dimension, key) DO UPDATE SET page_views = visitor_analytics.dimensions.page_views + 1;
  UPDATE visitor_analytics.state SET collected_since = statement_timestamp() WHERE singleton = true AND collected_since IS NULL;
  RETURN 'recorded';
END;
$$;
REVOKE ALL ON FUNCTION public.visitor_analytics_collect(uuid, text, text, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_analytics_collect(uuid, text, text, text, text, date) TO service_role;

CREATE FUNCTION public.visitor_analytics_report(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' SET lock_timeout = '1s' AS $$
DECLARE
  v_today date := (statement_timestamp() AT TIME ZONE 'Asia/Shanghai')::date;
BEGIN
  -- A near-midnight application request may still end on yesterday; never future.
  IF p_from IS NULL OR p_to IS NULL OR p_to NOT IN (v_today, v_today - 1) OR (p_to - p_from + 1) NOT IN (7, 30) THEN
    RAISE EXCEPTION 'Invalid analytics range';
  END IF;
  RETURN jsonb_build_object(
    'collected_since', (SELECT collected_since FROM visitor_analytics.state WHERE singleton = true),
    'days', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM (
      SELECT day, page_views, identified_page_views, unique_browsers, limited
      FROM visitor_analytics.daily WHERE day BETWEEN p_from AND p_to ORDER BY day
    ) d), '[]'::jsonb),
    'dimensions', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.dimension, d.page_views DESC, d.key) FROM (
      SELECT dimension, key, sum(page_views)::bigint AS page_views
      FROM visitor_analytics.dimensions WHERE day BETWEEN p_from AND p_to
      GROUP BY dimension, key
    ) d), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.visitor_analytics_report(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.visitor_analytics_report(date, date) TO service_role;

-- Keep retention active on this Free project without a network service, key,
-- paid resource, or dependence on incoming visits. pg_cron is already preloaded
-- and available as 1.6.4, but was not previously installed on the inspected target.
CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;
DO $check_cron$
BEGIN
  IF current_setting('cron.timezone', true) IS NULL OR current_setting('cron.timezone', true) NOT IN ('GMT', 'UTC', 'Etc/UTC') THEN
    RAISE EXCEPTION 'Expected UTC cron timezone';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'visitor-analytics-retention') THEN
    RAISE EXCEPTION 'Unexpected existing analytics retention job';
  END IF;
END;
$check_cron$;
SELECT cron.schedule(
  'visitor-analytics-retention',
  '15 16 * * *', -- 00:15 Asia/Shanghai; retention up to about 48h15m / 90d15m.
  $retention$
  SET statement_timeout = '30s';
  SET lock_timeout = '1s';
  SELECT visitor_analytics.prune();
  DELETE FROM cron.job_run_details
  WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'visitor-analytics-retention' AND username = current_user)
    AND end_time < statement_timestamp() - interval '7 days';
  $retention$
);
COMMIT;
