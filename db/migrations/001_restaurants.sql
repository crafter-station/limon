CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  canonical_url TEXT,
  slug TEXT UNIQUE,
  place_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  data JSONB,
  provider_data JSONB,
  error TEXT,
  lease_token UUID,
  lease_started_at TIMESTAMPTZ,
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status <> 'ready' OR (slug IS NOT NULL AND data IS NOT NULL))
);

-- migrate:split

CREATE INDEX IF NOT EXISTS restaurants_status_idx ON restaurants (status);
-- migrate:split
CREATE INDEX IF NOT EXISTS restaurants_place_id_idx ON restaurants (place_id);

-- migrate:split
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS provider_data JSONB;
-- migrate:split
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lease_token UUID;
-- migrate:split
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lease_started_at TIMESTAMPTZ;
-- migrate:split
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS generation_attempts INTEGER NOT NULL DEFAULT 0;

-- migrate:split
CREATE TABLE IF NOT EXISTS generation_rate_limits (
  requester_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (requester_key, window_started_at)
);
