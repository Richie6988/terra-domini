-- Terra Domini — Database initialization
-- Runs once on first Postgres container start

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram search on usernames
CREATE EXTENSION IF NOT EXISTS btree_gin; -- composite GIN indexes

-- Ensure UTC timezone
SET timezone = 'UTC';

-- ─── Performance tuning (applied at session level for init) ─────────────────
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '2GB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';  -- SSD
ALTER SYSTEM SET effective_io_concurrency = '200';
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET work_mem = '16MB';

-- ─── Application role (least-privilege) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'td_app') THEN
    CREATE ROLE td_app LOGIN PASSWORD 'change_me_app_password';
  END IF;
END$$;

GRANT CONNECT ON DATABASE terradomini TO td_app;
GRANT USAGE ON SCHEMA public TO td_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO td_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO td_app;

-- ─── Partition setup for high-volume tables ───────────────────────────────────
-- territory_ownership_history partitioned by month
-- (Django will create the base table; we add partitioning post-migration)

-- Kafka event audit log (immutable, append-only, partitioned by day)
CREATE TABLE IF NOT EXISTS game_events_log (
    id          UUID DEFAULT uuid_generate_v4(),
    event_type  VARCHAR(50) NOT NULL,
    player_id   UUID,
    session_id  VARCHAR(64),
    territory_h3 VARCHAR(20),
    payload     JSONB NOT NULL DEFAULT '{}',
    server_ts   TIMESTAMPTZ NOT NULL DEFAULT now(),
    client_ts   TIMESTAMPTZ,
    ip_address  INET,
    device_fp   VARCHAR(256)
) PARTITION BY RANGE (server_ts);

-- Create initial partitions (current month + 3 future months)
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE)::DATE;
    i INTEGER;
    part_start DATE;
    part_end DATE;
    part_name TEXT;
BEGIN
    FOR i IN 0..3 LOOP
        part_start := start_date + (i || ' months')::INTERVAL;
        part_end   := part_start + '1 month'::INTERVAL;
        part_name  := 'game_events_log_' || to_char(part_start, 'YYYY_MM');
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = part_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF game_events_log FOR VALUES FROM (%L) TO (%L)',
                part_name, part_start, part_end
            );
            EXECUTE format('CREATE INDEX ON %I (player_id, server_ts)', part_name);
            EXECUTE format('CREATE INDEX ON %I (event_type, server_ts)', part_name);
            EXECUTE format('CREATE INDEX ON %I USING GIN (payload)', part_name);
        END IF;
    END LOOP;
END$$;

-- ─── Geospatial indexes (created after Django migrations run) ─────────────────
-- These are advisory — Django/PostGIS may create them automatically,
-- but explicit creation ensures correct parameters.

-- Function to add geo indexes after migrations complete
CREATE OR REPLACE FUNCTION td_create_geo_indexes() RETURNS void AS $$
BEGIN
    -- H3 index — primary lookup
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'territories_h3_idx') THEN
        CREATE UNIQUE INDEX territories_h3_idx ON territories (h3_index);
    END IF;

    -- Spatial index on territory polygon geometry
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'territories_geom_gist') THEN
        CREATE INDEX territories_geom_gist ON territories USING GIST (geom);
    END IF;

    -- Spatial index on territory center point
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'territories_center_gist') THEN
        CREATE INDEX territories_center_gist ON territories USING GIST (center);
    END IF;

    -- Composite index for viewport queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'territories_owner_type_idx') THEN
        CREATE INDEX territories_owner_type_idx ON territories (owner_id, territory_type) WHERE owner_id IS NOT NULL;
    END IF;

    -- Trigram index for username search
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'players_username_trgm') THEN
        CREATE INDEX players_username_trgm ON players USING GIN (username gin_trgm_ops);
    END IF;

    -- Battle resolution index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'battles_resolves_status_idx') THEN
        CREATE INDEX battles_resolves_status_idx ON battles (resolves_at, status)
            WHERE status IN ('active', 'preparing');
    END IF;

    -- TDC transaction player+type
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tdc_tx_player_type_idx') THEN
        CREATE INDEX tdc_tx_player_type_idx ON tdc_transactions (player_id, transaction_type, created_at DESC);
    END IF;

    -- Ad campaign active filter
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ad_campaigns_active_idx') THEN
        CREATE INDEX ad_campaigns_active_idx ON ad_campaigns (status, ends_at)
            WHERE status = 'active';
    END IF;

    RAISE NOTICE 'Geo indexes created successfully';
END;
$$ LANGUAGE plpgsql;

-- ─── Territory hex boundary function ─────────────────────────────────────────
-- Returns nearby territory h3 indexes within radius (used as fallback for non-H3 queries)
CREATE OR REPLACE FUNCTION territories_near_point(
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    radius_m DOUBLE PRECISION DEFAULT 5000
)
RETURNS TABLE (h3_index VARCHAR, distance_m DOUBLE PRECISION) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.h3_index,
        ST_Distance(
            t.center::geography,
            ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
        ) AS distance_m
    FROM territories t
    WHERE ST_DWithin(
        t.center::geography,
        ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
        radius_m
    )
    ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- ─── Materialized view: leaderboard snapshot ─────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_territory AS
    SELECT
        p.id          AS player_id,
        p.username,
        p.commander_rank,
        ps.territories_owned,
        ps.season_score,
        ps.battles_won,
        a.tag         AS alliance_tag,
        ROW_NUMBER() OVER (ORDER BY ps.territories_owned DESC) AS rank_territory,
        ROW_NUMBER() OVER (ORDER BY ps.season_score DESC)      AS rank_season
    FROM players p
    LEFT JOIN player_stats ps ON ps.player_id = p.id
    LEFT JOIN alliance_members am ON am.player_id = p.id
    LEFT JOIN alliances a ON a.id = am.alliance_id
    WHERE p.is_active = true AND p.ban_status = 'clean'
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_territory_player_idx ON leaderboard_territory (player_id);

-- Refresh function (called by Celery beat every 5 min)
CREATE OR REPLACE FUNCTION refresh_leaderboard() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_territory;
END;
$$ LANGUAGE plpgsql;

-- ─── Audit trigger for TDC transactions ──────────────────────────────────────
-- Prevents any UPDATE/DELETE on tdc_transactions (immutable ledger)
CREATE OR REPLACE FUNCTION prevent_tdc_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Only allow status and confirmed_at updates
        IF OLD.amount_tdc != NEW.amount_tdc
           OR OLD.player_id != NEW.player_id
           OR OLD.transaction_type != NEW.transaction_type THEN
            RAISE EXCEPTION 'TDC transaction ledger is immutable: amount/player/type cannot be changed';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'TDC transaction ledger is immutable: records cannot be deleted';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied after migrations create the table
-- CREATE TRIGGER tdc_immutable_ledger
--     BEFORE UPDATE OR DELETE ON tdc_transactions
--     FOR EACH ROW EXECUTE FUNCTION prevent_tdc_mutation();

RAISE NOTICE 'Terra Domini database initialization complete';
