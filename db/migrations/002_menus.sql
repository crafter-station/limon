CREATE TABLE IF NOT EXISTS menu_representatives (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
ALTER TABLE menu_representatives
  ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

-- migrate:split
CREATE INDEX IF NOT EXISTS menu_representatives_restaurant_idx
  ON menu_representatives (restaurant_id);

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_rights_grants (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES menu_representatives(id),
  grantor_id TEXT,
  signer_authority TEXT,
  ownership_representation TEXT
    CHECK (ownership_representation IN ('creator', 'licensee', 'authorized_agent', 'other')),
  scopes TEXT[] NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  retention_class TEXT NOT NULL
    CHECK (retention_class IN ('durable_license', 'time_limited')),
  delete_after TIMESTAMPTZ,
  cascade_targets TEXT[] NOT NULL DEFAULT ARRAY[
    'original', 'transforms', 'ocr', 'model_io', 'derived_draft', 'backups'
  ],
  cascade_status TEXT NOT NULL DEFAULT 'not_due'
    CHECK (cascade_status IN ('not_due', 'pending', 'complete', 'failed')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (retention_class = 'durable_license' AND delete_after IS NULL)
    OR (retention_class = 'time_limited' AND delete_after IS NOT NULL)
  )
);

-- migrate:split
CREATE INDEX IF NOT EXISTS menu_rights_grants_expiry_idx
  ON menu_rights_grants (delete_after)
  WHERE revoked_at IS NULL AND cascade_status <> 'complete';

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_versions (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rights_grant_id UUID NOT NULL REFERENCES menu_rights_grants(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'needs_review', 'approved', 'published', 'superseded', 'revoked')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('owner_upload', 'licensed_feed', 'restaurant_url')),
  source_uri TEXT,
  source_external_id TEXT,
  source_retrieved_at TIMESTAMPTZ NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  pipeline JSONB NOT NULL,
  reviewer_id UUID REFERENCES menu_representatives(id),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status NOT IN ('approved', 'published', 'superseded') OR approved_at IS NOT NULL)
);

-- migrate:split
ALTER TABLE menu_versions
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

-- migrate:split
CREATE INDEX IF NOT EXISTS menu_versions_restaurant_idx
  ON menu_versions (restaurant_id, created_at DESC);

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_source_assets (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  rights_grant_id UUID NOT NULL REFERENCES menu_rights_grants(id),
  menu_version_id UUID NOT NULL REFERENCES menu_versions(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL CHECK (page_index >= 0),
  original_name TEXT,
  mime_type TEXT,
  byte_size INTEGER CHECK (byte_size IS NULL OR byte_size > 0),
  width_px INTEGER,
  height_px INTEGER,
  page_count INTEGER NOT NULL DEFAULT 1 CHECK (page_count > 0),
  original_sha256 TEXT,
  transformed_sha256 TEXT,
  perceptual_hash TEXT,
  original_blob_url TEXT,
  transformed_blob_url TEXT,
  transformations JSONB NOT NULL DEFAULT '[]'::jsonb,
  malware_scanner TEXT,
  malware_scanner_version TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_version_id, page_index)
);

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_ocr_artifacts (
  id UUID PRIMARY KEY,
  source_asset_id UUID NOT NULL REFERENCES menu_source_assets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_version TEXT NOT NULL,
  artifact_uri TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL,
  coordinate_space TEXT NOT NULL DEFAULT 'transformed_asset_pixels',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_extraction_jobs (
  id UUID PRIMARY KEY,
  menu_version_id UUID NOT NULL UNIQUE REFERENCES menu_versions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  lease_token UUID,
  lease_started_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  checkpoint JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
CREATE TABLE IF NOT EXISTS restaurant_menu_publications (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_version_id UUID NOT NULL UNIQUE REFERENCES menu_versions(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_deletion_jobs (
  id UUID PRIMARY KEY,
  rights_grant_id UUID NOT NULL UNIQUE REFERENCES menu_rights_grants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  lease_token UUID,
  lease_started_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_upload_batches (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  representative_id UUID NOT NULL REFERENCES menu_representatives(id),
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'committed', 'cleanup_pending', 'cleaned')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
ALTER TABLE menu_versions
  ADD COLUMN IF NOT EXISTS upload_batch_id UUID UNIQUE
  REFERENCES menu_upload_batches(id);

-- migrate:split
CREATE INDEX IF NOT EXISTS menu_upload_batches_cleanup_idx
  ON menu_upload_batches (updated_at)
  WHERE status IN ('uploading', 'cleanup_pending');

-- migrate:split
CREATE TABLE IF NOT EXISTS menu_audit_events (
  id UUID PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_version_id UUID,
  rights_grant_id UUID,
  representative_id UUID,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migrate:split
CREATE OR REPLACE FUNCTION protect_approved_menu_content()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('approved', 'published', 'superseded')
    AND NOT (NEW.status = 'revoked' AND NEW.sections = '[]'::jsonb)
    AND (
    NEW.sections IS DISTINCT FROM OLD.sections
    OR NEW.pipeline IS DISTINCT FROM OLD.pipeline
    OR NEW.rights_grant_id IS DISTINCT FROM OLD.rights_grant_id
    OR NEW.source_kind IS DISTINCT FROM OLD.source_kind
    OR NEW.source_uri IS DISTINCT FROM OLD.source_uri
    OR NEW.source_external_id IS DISTINCT FROM OLD.source_external_id
  ) THEN
    RAISE EXCEPTION 'approved menu content is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- migrate:split
DROP TRIGGER IF EXISTS menu_versions_immutable_content ON menu_versions;

-- migrate:split
CREATE TRIGGER menu_versions_immutable_content
BEFORE UPDATE ON menu_versions
FOR EACH ROW EXECUTE FUNCTION protect_approved_menu_content();
