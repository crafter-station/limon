import "server-only";

import { neon } from "@neondatabase/serverless";
import { cache } from "react";
import type { MenuPipeline, MenuSection, MenuVersionStatus } from "@/lib/menus";

type MenuVersionRow = {
  id: string;
  restaurant_id: string;
  rights_grant_id: string;
  status: MenuVersionStatus;
  sections: MenuSection[];
  pipeline: MenuPipeline;
  reviewer_id: string | null;
  reviewed_at: string | Date | null;
  approved_at: string | Date | null;
  published_at: string | Date | null;
  revision: number;
  created_at: string | Date;
  updated_at: string | Date;
};

type MenuAssetRow = {
  id: string;
  page_index: number;
  original_name: string | null;
  mime_type: string | null;
  byte_size: number | null;
  width_px: number | null;
  height_px: number | null;
  page_count: number;
  original_sha256: string | null;
  transformed_sha256: string | null;
  perceptual_hash: string | null;
  original_blob_url: string | null;
  transformed_blob_url: string | null;
  transformations: string[];
  deleted_at: string | Date | null;
};

type GrantRow = {
  id: string;
  restaurant_id: string;
  grantor_id: string | null;
  signer_authority: string | null;
  ownership_representation: string | null;
  scopes: string[];
  granted_at: string | Date;
  revoked_at: string | Date | null;
  retention_class: "durable_license" | "time_limited";
  delete_after: string | Date | null;
  cascade_targets: string[];
  cascade_status: "not_due" | "pending" | "complete" | "failed";
  deleted_at: string | Date | null;
};

export type MenuVersionRecord = ReturnType<typeof versionFromRow>;
export type MenuAssetRecord = ReturnType<typeof assetFromRow>;
export type MenuGrantRecord = ReturnType<typeof grantFromRow>;

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return neon(connectionString);
}

function iso(value: string | Date | null) {
  return value ? new Date(value).toISOString() : null;
}

function versionFromRow(row: MenuVersionRow) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    rightsGrantId: row.rights_grant_id,
    status: row.status,
    sections: row.sections,
    pipeline: row.pipeline,
    reviewerId: row.reviewer_id,
    reviewedAt: iso(row.reviewed_at),
    approvedAt: iso(row.approved_at),
    publishedAt: iso(row.published_at),
    revision: Number(row.revision),
    createdAt: iso(row.created_at) as string,
    updatedAt: iso(row.updated_at) as string,
  };
}

function assetFromRow(row: MenuAssetRow) {
  return {
    id: row.id,
    pageIndex: Number(row.page_index),
    originalName: row.original_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    widthPx: row.width_px === null ? null : Number(row.width_px),
    heightPx: row.height_px === null ? null : Number(row.height_px),
    pageCount: Number(row.page_count),
    originalSha256: row.original_sha256,
    transformedSha256: row.transformed_sha256,
    perceptualHash: row.perceptual_hash,
    originalBlobUrl: row.original_blob_url,
    transformedBlobUrl: row.transformed_blob_url,
    transformations: row.transformations,
    deletedAt: iso(row.deleted_at),
  };
}

function grantFromRow(row: GrantRow) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    grantorId: row.grantor_id,
    signerAuthority: row.signer_authority,
    ownershipRepresentation: row.ownership_representation,
    scopes: row.scopes,
    grantedAt: iso(row.granted_at) as string,
    revokedAt: iso(row.revoked_at),
    retentionClass: row.retention_class,
    deleteAfter: iso(row.delete_after),
    cascadeTargets: row.cascade_targets,
    cascadeStatus: row.cascade_status,
    deletedAt: iso(row.deleted_at),
  };
}

export async function consumeVerifiedMenuRepresentative(
  restaurantId: string,
  tokenHash: string,
) {
  const rows = await database()`
    UPDATE menu_representatives SET consumed_at = NOW()
    WHERE id = (
      SELECT id FROM menu_representatives
      WHERE restaurant_id = ${restaurantId}
        AND token_hash = ${tokenHash}
        AND consumed_at IS NULL AND revoked_at IS NULL
      LIMIT 1
    )
    RETURNING id, restaurant_id, display_name
  `;
  const row = rows[0] as
    | { id: string; restaurant_id: string; display_name: string }
    | undefined;
  return row
    ? {
        id: row.id,
        restaurantId: row.restaurant_id,
        displayName: row.display_name,
      }
    : undefined;
}

export async function findMenuRepresentativeById(
  restaurantId: string,
  representativeId: string,
) {
  const rows = await database()`
    SELECT id, restaurant_id, display_name
    FROM menu_representatives
    WHERE restaurant_id = ${restaurantId}
      AND id = ${representativeId}
      AND revoked_at IS NULL
    LIMIT 1
  `;
  const row = rows[0] as
    | { id: string; restaurant_id: string; display_name: string }
    | undefined;
  return row
    ? {
        id: row.id,
        restaurantId: row.restaurant_id,
        displayName: row.display_name,
      }
    : undefined;
}

export type StoredAssetInput = {
  id: string;
  pageIndex: number;
  originalName: string;
  mimeType: string;
  byteSize: number;
  widthPx: number | null;
  heightPx: number | null;
  pageCount: number;
  originalSha256: string;
  transformedSha256: string;
  perceptualHash: string | null;
  originalBlobUrl: string;
  transformedBlobUrl: string;
  transformations: string[];
  malwareScanner: string;
  malwareScannerVersion: string;
};

export async function createMenuUploadBatch(
  id: string,
  restaurantId: string,
  representativeId: string,
) {
  await database()`
    INSERT INTO menu_upload_batches (id, restaurant_id, representative_id)
    VALUES (${id}, ${restaurantId}, ${representativeId})
  `;
}

export async function setMenuUploadBatchStatus(
  id: string,
  status: "cleaned" | "cleanup_pending" | "committed",
  error?: string,
) {
  await database()`
    UPDATE menu_upload_batches SET status = ${status},
      error = ${error?.slice(0, 500) ?? null}, updated_at = NOW()
    WHERE id = ${id} AND status <> 'committed'
  `;
}

export async function claimAbandonedMenuUploadBatch() {
  const rows = await database()`
    WITH candidate AS (
      SELECT id FROM menu_upload_batches
      WHERE status = 'cleanup_pending'
        OR (status = 'uploading' AND updated_at < NOW() - INTERVAL '30 minutes')
      ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE menu_upload_batches b SET updated_at = NOW()
    FROM candidate WHERE b.id = candidate.id
    RETURNING b.id, b.restaurant_id
  `;
  const row = rows[0] as { id: string; restaurant_id: string } | undefined;
  return row ? { id: row.id, restaurantId: row.restaurant_id } : undefined;
}

export async function createMenuUpload(input: {
  uploadBatchId: string;
  restaurantId: string;
  representativeId: string;
  grantorId: string;
  signerAuthority: string;
  ownershipRepresentation: string;
  scopes: string[];
  retentionClass: string;
  deleteAfter: string | null;
  pipeline: MenuPipeline;
  assets: StoredAssetInput[];
}) {
  const sql = database();
  const grantId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const retrievedAt = new Date().toISOString();
  await sql.transaction((tx) => [
    tx`
      INSERT INTO menu_rights_grants (
        id, restaurant_id, representative_id, grantor_id, signer_authority,
        ownership_representation, scopes, granted_at, retention_class, delete_after
      ) VALUES (
        ${grantId}, ${input.restaurantId}, ${input.representativeId},
        ${input.grantorId}, ${input.signerAuthority}, ${input.ownershipRepresentation},
        ${input.scopes}, ${retrievedAt}, ${input.retentionClass}, ${input.deleteAfter}
      )
    `,
    tx`
      INSERT INTO menu_versions (
        id, restaurant_id, rights_grant_id, upload_batch_id, status, source_kind,
        source_retrieved_at, pipeline
      ) VALUES (
        ${versionId}, ${input.restaurantId}, ${grantId}, ${input.uploadBatchId},
        'draft', 'owner_upload',
        ${retrievedAt}, ${JSON.stringify(input.pipeline)}::jsonb
      )
    `,
    ...input.assets.map(
      (asset) => tx`
        INSERT INTO menu_source_assets (
          id, restaurant_id, rights_grant_id, menu_version_id, page_index,
          original_name, mime_type, byte_size, width_px, height_px, page_count,
          original_sha256, transformed_sha256, perceptual_hash,
          original_blob_url, transformed_blob_url, transformations,
          malware_scanner, malware_scanner_version
        ) VALUES (
          ${asset.id}, ${input.restaurantId}, ${grantId}, ${versionId},
          ${asset.pageIndex}, ${asset.originalName}, ${asset.mimeType},
          ${asset.byteSize}, ${asset.widthPx}, ${asset.heightPx}, ${asset.pageCount},
          ${asset.originalSha256}, ${asset.transformedSha256}, ${asset.perceptualHash},
          ${asset.originalBlobUrl}, ${asset.transformedBlobUrl},
          ${JSON.stringify(asset.transformations)}::jsonb,
          ${asset.malwareScanner}, ${asset.malwareScannerVersion}
        )
      `,
    ),
    tx`
      INSERT INTO menu_extraction_jobs (id, menu_version_id)
      VALUES (${jobId}, ${versionId})
    `,
    tx`
      INSERT INTO menu_audit_events (
        id, restaurant_id, menu_version_id, rights_grant_id,
        representative_id, action
      ) VALUES (
        ${crypto.randomUUID()}, ${input.restaurantId}, ${versionId}, ${grantId},
        ${input.representativeId}, 'menu.uploaded'
      )
    `,
    tx`
      UPDATE menu_upload_batches SET status = 'committed', error = NULL,
        updated_at = NOW()
      WHERE id = ${input.uploadBatchId} AND restaurant_id = ${input.restaurantId}
        AND status = 'uploading'
    `,
  ]);
  return { grantId, versionId };
}

export async function getMenuVersion(versionId: string) {
  const rows =
    await database()`SELECT * FROM menu_versions WHERE id = ${versionId}`;
  const row = rows[0] as MenuVersionRow | undefined;
  return row ? versionFromRow(row) : undefined;
}

export async function getMenuAssets(versionId: string) {
  const rows = await database()`
    SELECT * FROM menu_source_assets
    WHERE menu_version_id = ${versionId} AND deleted_at IS NULL
    ORDER BY page_index
  `;
  return (rows as MenuAssetRow[]).map(assetFromRow);
}

export async function getAuthorizedMenuAsset(
  restaurantId: string,
  assetId: string,
) {
  const rows = await database()`
    SELECT a.* FROM menu_source_assets a
    JOIN menu_rights_grants g ON g.id = a.rights_grant_id
    WHERE a.id = ${assetId} AND a.restaurant_id = ${restaurantId}
      AND a.deleted_at IS NULL
      AND g.revoked_at IS NULL AND g.cascade_status = 'not_due'
      AND (g.delete_after IS NULL OR g.delete_after > NOW())
    LIMIT 1
  `;
  const row = rows[0] as MenuAssetRow | undefined;
  return row ? assetFromRow(row) : undefined;
}

export async function claimMenuExtraction(versionId: string) {
  const sql = database();
  const leaseToken = crypto.randomUUID();
  const rows = await sql`
    UPDATE menu_extraction_jobs j
    SET status = 'processing', lease_token = ${leaseToken}, lease_started_at = NOW(),
      attempts = attempts + 1, error = NULL, updated_at = NOW()
    FROM menu_versions v, menu_rights_grants g
    WHERE j.menu_version_id = ${versionId}
      AND v.id = j.menu_version_id
      AND g.id = v.rights_grant_id AND g.revoked_at IS NULL
      AND g.cascade_status = 'not_due'
      AND (g.delete_after IS NULL OR g.delete_after > NOW())
      AND v.status IN ('draft', 'needs_review')
      AND j.attempts < 4
      AND (
        j.status IN ('pending', 'failed')
        OR (j.status = 'processing' AND j.lease_started_at < NOW() - INTERVAL '5 minutes')
      )
    RETURNING j.menu_version_id
  `;
  return rows.length ? leaseToken : undefined;
}

export async function completeMenuExtraction(
  versionId: string,
  leaseToken: string,
  sections: MenuSection[],
  pipeline: MenuPipeline,
) {
  const sql = database();
  const results = await sql.transaction((tx) => [
    tx`
      UPDATE menu_versions v
      SET sections = ${JSON.stringify(sections)}::jsonb,
        pipeline = ${JSON.stringify(pipeline)}::jsonb,
        status = 'needs_review', revision = revision + 1, updated_at = NOW()
      FROM menu_extraction_jobs j, menu_rights_grants g
      WHERE v.id = ${versionId} AND j.menu_version_id = v.id
        AND g.id = v.rights_grant_id AND g.revoked_at IS NULL
        AND g.cascade_status = 'not_due'
        AND (g.delete_after IS NULL OR g.delete_after > NOW())
        AND j.status = 'processing' AND j.lease_token = ${leaseToken}
        AND v.status IN ('draft', 'needs_review')
      RETURNING v.id
    `,
    tx`
      UPDATE menu_extraction_jobs
      SET status = 'completed', lease_token = NULL, lease_started_at = NULL,
        checkpoint = ${JSON.stringify({ stage: "reconciled", schemaVersion: pipeline.schemaVersion })}::jsonb,
        updated_at = NOW()
      WHERE menu_version_id = ${versionId}
        AND status = 'processing' AND lease_token = ${leaseToken}
        AND EXISTS (
          SELECT 1 FROM menu_versions v
          JOIN menu_rights_grants g ON g.id = v.rights_grant_id
          WHERE v.id = ${versionId} AND g.revoked_at IS NULL
            AND g.cascade_status = 'not_due'
            AND (g.delete_after IS NULL OR g.delete_after > NOW())
        )
      RETURNING menu_version_id
    `,
  ]);
  return results[0].length > 0 && results[1].length > 0;
}

export async function failMenuExtraction(
  versionId: string,
  leaseToken: string,
  error: string,
) {
  await database()`
    UPDATE menu_extraction_jobs SET status = 'failed', error = ${error.slice(0, 500)},
      lease_token = NULL, lease_started_at = NULL, updated_at = NOW()
    WHERE menu_version_id = ${versionId} AND status = 'processing'
      AND lease_token = ${leaseToken}
  `;
}

export async function getMenuDashboard(restaurantId: string) {
  const sql = database();
  const [restaurantRows, versionRows] = await Promise.all([
    sql`SELECT id, slug, data FROM restaurants WHERE id = ${restaurantId} LIMIT 1`,
    sql`
      SELECT * FROM menu_versions
      WHERE restaurant_id = ${restaurantId}
      ORDER BY created_at DESC LIMIT 1
    `,
  ]);
  const restaurant = restaurantRows[0] as
    | { id: string; slug: string | null; data: { name?: string } | null }
    | undefined;
  const versionRow = versionRows[0] as MenuVersionRow | undefined;
  if (!restaurant) return undefined;
  const version = versionRow ? versionFromRow(versionRow) : undefined;
  const [assets, grantRows, extractionRows] = version
    ? await Promise.all([
        getMenuAssets(version.id),
        sql`SELECT * FROM menu_rights_grants WHERE id = ${version.rightsGrantId}`,
        sql`
          SELECT status, attempts, error FROM menu_extraction_jobs
          WHERE menu_version_id = ${version.id}
        `,
      ])
    : [[], [], []];
  const grantRow = grantRows[0] as GrantRow | undefined;
  const extractionRow = extractionRows[0] as
    | { status: string; attempts: number; error: string | null }
    | undefined;
  return {
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.data?.name ?? "Restaurant",
    },
    version,
    assets,
    grant: grantRow ? grantFromRow(grantRow) : undefined,
    extraction: extractionRow
      ? {
          status: extractionRow.status,
          attempts: Number(extractionRow.attempts),
          error: extractionRow.error,
        }
      : undefined,
  };
}

export async function saveOwnerMenuReview(input: {
  restaurantId: string;
  versionId: string;
  representativeId: string;
  expectedRevision: number;
  sections: MenuSection[];
}) {
  const rows = await database()`
    WITH updated AS (
      UPDATE menu_versions SET sections = ${JSON.stringify(input.sections)}::jsonb,
        reviewer_id = ${input.representativeId}, reviewed_at = NOW(),
        revision = revision + 1, updated_at = NOW()
      WHERE id = ${input.versionId} AND restaurant_id = ${input.restaurantId}
        AND status = 'needs_review' AND revision = ${input.expectedRevision}
        AND EXISTS (
          SELECT 1 FROM menu_rights_grants g
          WHERE g.id = menu_versions.rights_grant_id AND g.revoked_at IS NULL
            AND g.cascade_status = 'not_due'
            AND (g.delete_after IS NULL OR g.delete_after > NOW())
        )
      RETURNING id, rights_grant_id
    )
    INSERT INTO menu_audit_events (
      id, restaurant_id, menu_version_id, rights_grant_id,
      representative_id, action
    ) SELECT ${crypto.randomUUID()}, ${input.restaurantId}, id, rights_grant_id,
      ${input.representativeId}, 'menu.reviewed' FROM updated
    RETURNING menu_version_id
  `;
  if (!rows.length)
    throw new Error(
      "The menu changed in another session. Reload and review again.",
    );
  const version = await getMenuVersion(input.versionId);
  if (!version) throw new Error("The reviewed menu could not be reloaded.");
  return version;
}

export async function approveMenuVersion(input: {
  restaurantId: string;
  versionId: string;
  representativeId: string;
  expectedRevision: number;
  sections: MenuSection[];
}) {
  const rows = await database()`
    WITH updated AS (
      UPDATE menu_versions v SET sections = ${JSON.stringify(input.sections)}::jsonb,
        status = 'approved', reviewer_id = ${input.representativeId},
        reviewed_at = NOW(), approved_at = NOW(), revision = revision + 1,
        updated_at = NOW()
      FROM menu_rights_grants g
      WHERE v.id = ${input.versionId} AND v.restaurant_id = ${input.restaurantId}
        AND v.rights_grant_id = g.id AND v.status = 'needs_review'
        AND v.revision = ${input.expectedRevision}
        AND g.revoked_at IS NULL AND g.cascade_status = 'not_due'
        AND ARRAY['copy', 'model_process', 'evaluate', 'review', 'retain', 'derive', 'publish']::TEXT[] <@ g.scopes
        AND (g.delete_after IS NULL OR g.delete_after > NOW())
      RETURNING v.id, v.rights_grant_id
    )
    INSERT INTO menu_audit_events (
      id, restaurant_id, menu_version_id, rights_grant_id,
      representative_id, action
    ) SELECT ${crypto.randomUUID()}, ${input.restaurantId}, id, rights_grant_id,
      ${input.representativeId}, 'menu.approved' FROM updated
    RETURNING menu_version_id
  `;
  if (!rows.length) throw new Error("This menu is not eligible for approval.");
  const version = await getMenuVersion(input.versionId);
  if (!version) throw new Error("The approved menu could not be reloaded.");
  return version;
}

export async function publishMenuVersion(input: {
  restaurantId: string;
  versionId: string;
  representativeId: string;
}) {
  const sql = database();
  const published = await sql`
    WITH locked AS (
      SELECT pg_advisory_xact_lock(hashtextextended(${input.restaurantId}, 0))
    ), eligible AS (
      UPDATE menu_versions v SET status = 'published', published_at = NOW(),
        updated_at = NOW()
      FROM menu_rights_grants g
      WHERE v.id = ${input.versionId} AND v.restaurant_id = ${input.restaurantId}
        AND v.rights_grant_id = g.id AND v.status = 'approved'
        AND g.revoked_at IS NULL AND g.cascade_status = 'not_due'
        AND EXISTS (SELECT 1 FROM locked)
        AND ARRAY['copy', 'model_process', 'evaluate', 'review', 'retain', 'derive', 'publish']::TEXT[] <@ g.scopes
        AND (g.delete_after IS NULL OR g.delete_after > NOW())
      RETURNING v.id, v.restaurant_id
    ), superseded AS (
      UPDATE menu_versions SET status = 'superseded', updated_at = NOW()
      WHERE restaurant_id = ${input.restaurantId} AND status = 'published'
        AND id <> ${input.versionId}
        AND EXISTS (SELECT 1 FROM eligible)
    )
    , publication AS (
      INSERT INTO restaurant_menu_publications (restaurant_id, menu_version_id)
      SELECT restaurant_id, id FROM eligible
      ON CONFLICT (restaurant_id) DO UPDATE SET
        menu_version_id = EXCLUDED.menu_version_id, published_at = NOW()
      RETURNING menu_version_id
    ), audit AS (
      INSERT INTO menu_audit_events (
        id, restaurant_id, menu_version_id, representative_id, action
      ) SELECT ${crypto.randomUUID()}, restaurant_id, id,
        ${input.representativeId}, 'menu.published' FROM eligible
      RETURNING menu_version_id
    )
    SELECT id FROM eligible
    WHERE EXISTS (SELECT 1 FROM publication) AND EXISTS (SELECT 1 FROM audit)
  `;
  if (!published.length)
    throw new Error("Only an active approved menu can be published.");
}

async function findPublishedMenu(restaurantId: string) {
  const rows = await database()`
    SELECT v.* FROM restaurant_menu_publications p
    JOIN menu_versions v ON v.id = p.menu_version_id
    JOIN menu_rights_grants g ON g.id = v.rights_grant_id
    WHERE p.restaurant_id = ${restaurantId} AND v.restaurant_id = ${restaurantId}
      AND v.status = 'published' AND v.approved_at IS NOT NULL
      AND g.revoked_at IS NULL AND g.cascade_status = 'not_due'
      AND ARRAY['copy', 'model_process', 'evaluate', 'review', 'retain', 'derive', 'publish']::TEXT[] <@ g.scopes
      AND (g.delete_after IS NULL OR g.delete_after > NOW())
    LIMIT 1
  `;
  const row = rows[0] as MenuVersionRow | undefined;
  return row ? versionFromRow(row) : undefined;
}

export const getPublishedMenu = cache(findPublishedMenu);

export async function revokeMenuGrant(input: {
  restaurantId: string;
  rightsGrantId: string;
  representativeId: string | null;
}) {
  const sql = database();
  const grants = await sql`
    SELECT cascade_status FROM menu_rights_grants
    WHERE id = ${input.rightsGrantId} AND restaurant_id = ${input.restaurantId}
    LIMIT 1
  `;
  const grant = grants[0] as { cascade_status: string } | undefined;
  if (!grant) throw new Error("Menu rights grant was not found.");
  if (grant.cascade_status === "complete") return;
  const jobId = crypto.randomUUID();
  const results = await sql.transaction((tx) => [
    tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.restaurantId}, 0))`,
    tx`
      DELETE FROM restaurant_menu_publications p
      USING menu_versions v
      WHERE p.menu_version_id = v.id AND v.rights_grant_id = ${input.rightsGrantId}
        AND v.restaurant_id = ${input.restaurantId}
    `,
    tx`
      UPDATE menu_versions SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
      WHERE rights_grant_id = ${input.rightsGrantId}
        AND restaurant_id = ${input.restaurantId} AND status <> 'revoked'
    `,
    tx`
      UPDATE menu_rights_grants SET revoked_at = COALESCE(revoked_at, NOW()),
        cascade_status = 'pending'
      WHERE id = ${input.rightsGrantId} AND restaurant_id = ${input.restaurantId}
      RETURNING id
    `,
    tx`
      INSERT INTO menu_deletion_jobs (id, rights_grant_id)
      SELECT ${jobId}, id FROM menu_rights_grants
      WHERE id = ${input.rightsGrantId} AND restaurant_id = ${input.restaurantId}
      ON CONFLICT (rights_grant_id) DO UPDATE SET
        status = 'pending',
        error = NULL, updated_at = NOW()
    `,
    tx`
      INSERT INTO menu_audit_events (
        id, restaurant_id, rights_grant_id, representative_id, action
      ) SELECT ${crypto.randomUUID()}, restaurant_id, id,
        ${input.representativeId}, 'menu.revoked'
      FROM menu_rights_grants
      WHERE id = ${input.rightsGrantId} AND restaurant_id = ${input.restaurantId}
    `,
  ]);
  if (!results[3].length) throw new Error("Menu rights grant was not found.");
}

export async function enqueueExpiredMenuGrants() {
  const sql = database();
  const rows = await sql`
    SELECT id, restaurant_id FROM menu_rights_grants
    WHERE delete_after <= NOW() AND revoked_at IS NULL AND cascade_status <> 'complete'
  `;
  for (const row of rows as { id: string; restaurant_id: string }[]) {
    await revokeMenuGrant({
      restaurantId: row.restaurant_id,
      rightsGrantId: row.id,
      representativeId: null,
    });
  }
  return rows.length;
}

export async function claimMenuDeletionJob(rightsGrantId?: string) {
  const leaseToken = crypto.randomUUID();
  const rows = await database()`
    WITH candidate AS (
      SELECT id FROM menu_deletion_jobs
      WHERE (${rightsGrantId ?? null}::uuid IS NULL OR rights_grant_id = ${rightsGrantId ?? null})
        AND (
          status IN ('pending', 'failed')
          OR (status = 'processing' AND lease_started_at < NOW() - INTERVAL '10 minutes')
        )
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE menu_deletion_jobs j
    SET status = 'processing', lease_token = ${leaseToken},
      lease_started_at = NOW(), attempts = attempts + 1, error = NULL, updated_at = NOW()
    FROM candidate
    WHERE j.id = candidate.id
    RETURNING j.id, j.rights_grant_id
  `;
  const row = rows[0] as { id: string; rights_grant_id: string } | undefined;
  return row
    ? { id: row.id, rightsGrantId: row.rights_grant_id, leaseToken }
    : undefined;
}

export async function getDeletionBlobUrls(rightsGrantId: string) {
  const sql = database();
  const [rows, ocrRows] = await Promise.all([
    sql`
      SELECT original_blob_url, transformed_blob_url
      FROM menu_source_assets
      WHERE rights_grant_id = ${rightsGrantId} AND deleted_at IS NULL
    `,
    sql`
      SELECT o.artifact_uri FROM menu_ocr_artifacts o
      JOIN menu_source_assets a ON a.id = o.source_asset_id
      WHERE a.rights_grant_id = ${rightsGrantId}
    `,
  ]);
  return [
    ...new Set([
      ...rows.flatMap((row) => {
        const value = row as {
          original_blob_url: string | null;
          transformed_blob_url: string | null;
        };
        return [value.original_blob_url, value.transformed_blob_url].filter(
          (url): url is string => Boolean(url),
        );
      }),
      ...ocrRows.map((row) => (row as { artifact_uri: string }).artifact_uri),
    ]),
  ];
}

export async function completeMenuDeletion(
  jobId: string,
  rightsGrantId: string,
  leaseToken: string,
) {
  const sql = database();
  const results = await sql.transaction((tx) => [
    tx`
      UPDATE menu_deletion_jobs SET status = 'complete', updated_at = NOW()
      WHERE id = ${jobId} AND rights_grant_id = ${rightsGrantId}
        AND status = 'processing' AND lease_token = ${leaseToken}
      RETURNING rights_grant_id
    `,
    tx`
      DELETE FROM menu_ocr_artifacts o USING menu_source_assets a
      WHERE o.source_asset_id = a.id AND a.rights_grant_id = ${rightsGrantId}
        AND EXISTS (
          SELECT 1 FROM menu_deletion_jobs j WHERE j.id = ${jobId}
            AND j.status = 'complete' AND j.lease_token = ${leaseToken}
        )
    `,
    tx`
      UPDATE menu_source_assets SET original_name = NULL, mime_type = NULL,
        byte_size = NULL, width_px = NULL, height_px = NULL,
        original_sha256 = NULL, transformed_sha256 = NULL, perceptual_hash = NULL,
        original_blob_url = NULL, transformed_blob_url = NULL,
        transformations = '[]'::jsonb, malware_scanner = NULL,
        malware_scanner_version = NULL, deleted_at = NOW()
      WHERE rights_grant_id = ${rightsGrantId}
        AND EXISTS (
          SELECT 1 FROM menu_deletion_jobs j WHERE j.id = ${jobId}
            AND j.status = 'complete' AND j.lease_token = ${leaseToken}
        )
    `,
    tx`
      UPDATE menu_versions SET sections = '[]'::jsonb, status = 'revoked',
        source_uri = NULL, source_external_id = NULL, updated_at = NOW()
      WHERE rights_grant_id = ${rightsGrantId}
        AND EXISTS (
          SELECT 1 FROM menu_deletion_jobs j WHERE j.id = ${jobId}
            AND j.status = 'complete' AND j.lease_token = ${leaseToken}
        )
    `,
    tx`
      UPDATE menu_extraction_jobs j SET checkpoint = NULL, error = NULL, updated_at = NOW()
      FROM menu_versions v
      WHERE j.menu_version_id = v.id AND v.rights_grant_id = ${rightsGrantId}
        AND EXISTS (
          SELECT 1 FROM menu_deletion_jobs d WHERE d.id = ${jobId}
            AND d.status = 'complete' AND d.lease_token = ${leaseToken}
        )
    `,
    tx`
      UPDATE menu_rights_grants SET grantor_id = NULL, signer_authority = NULL,
        ownership_representation = NULL, scopes = ARRAY[]::TEXT[],
        cascade_status = 'complete', deleted_at = NOW()
      WHERE id = ${rightsGrantId}
        AND EXISTS (
          SELECT 1 FROM menu_deletion_jobs j WHERE j.id = ${jobId}
            AND j.status = 'complete' AND j.lease_token = ${leaseToken}
        )
    `,
    tx`
      INSERT INTO menu_audit_events (
        id, restaurant_id, rights_grant_id, action
      ) SELECT ${crypto.randomUUID()}, g.restaurant_id, g.id, 'menu.deletion_completed'
      FROM menu_rights_grants g
      WHERE g.id = ${rightsGrantId}
        AND EXISTS (
          SELECT 1 FROM menu_deletion_jobs j WHERE j.id = ${jobId}
            AND j.status = 'complete' AND j.lease_token = ${leaseToken}
        )
    `,
    tx`
      UPDATE menu_deletion_jobs SET lease_token = NULL,
        lease_started_at = NULL, error = NULL, updated_at = NOW()
      WHERE id = ${jobId} AND rights_grant_id = ${rightsGrantId}
        AND status = 'complete' AND lease_token = ${leaseToken}
    `,
  ]);
  return results[0].length > 0;
}

export async function failMenuDeletion(
  jobId: string,
  leaseToken: string,
  error: string,
) {
  const sql = database();
  const rows = await sql`
    UPDATE menu_deletion_jobs SET status = 'failed', error = ${error.slice(0, 500)},
      lease_token = NULL, lease_started_at = NULL, updated_at = NOW()
    WHERE id = ${jobId} AND status = 'processing' AND lease_token = ${leaseToken}
    RETURNING rights_grant_id
  `;
  const row = rows[0] as { rights_grant_id: string } | undefined;
  if (row) {
    await sql`
      UPDATE menu_rights_grants SET cascade_status = 'failed'
      WHERE id = ${row.rights_grant_id}
    `;
  }
}
