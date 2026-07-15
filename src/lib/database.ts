import "server-only";

import { neon } from "@neondatabase/serverless";
import { cache } from "react";
import type { Restaurant } from "@/lib/restaurants";

export type RestaurantStatus = "failed" | "generating" | "pending" | "ready";

export type RestaurantRecord = {
  id: string;
  sourceUrl: string;
  canonicalUrl?: string;
  slug?: string;
  placeId?: string;
  status: RestaurantStatus;
  data?: Restaurant;
  providerData?: Restaurant;
  error?: string;
  leaseToken?: string;
  leaseStartedAt?: string;
  generationAttempts: number;
  createdAt: string;
  updatedAt: string;
};

type RestaurantRow = {
  id: string;
  source_url: string;
  canonical_url: string | null;
  slug: string | null;
  place_id: string | null;
  status: RestaurantStatus;
  data: Restaurant | null;
  provider_data: Restaurant | null;
  error: string | null;
  lease_token: string | null;
  lease_started_at: string | Date | null;
  generation_attempts: number;
  created_at: string | Date;
  updated_at: string | Date;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRestaurantId(value: string) {
  return UUID.test(value);
}

function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(connectionString);
}

function recordFromRow(row: RestaurantRow): RestaurantRecord {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    canonicalUrl: row.canonical_url ?? undefined,
    slug: row.slug ?? undefined,
    placeId: row.place_id ?? undefined,
    status: row.status,
    data: row.data ?? undefined,
    providerData: row.provider_data ?? undefined,
    error: row.error ?? undefined,
    leaseToken: row.lease_token ?? undefined,
    leaseStartedAt: row.lease_started_at
      ? new Date(row.lease_started_at).toISOString()
      : undefined,
    generationAttempts: Number(row.generation_attempts),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function createRestaurantRecord(sourceUrl: string) {
  const id = crypto.randomUUID();
  const sql = database();
  const rows = await sql`
    INSERT INTO restaurants (id, source_url)
    VALUES (${id}, ${sourceUrl})
    ON CONFLICT (source_url) DO UPDATE SET
      updated_at = NOW()
    RETURNING *
  `;

  return recordFromRow(rows[0] as RestaurantRow);
}

export async function consumeGenerationAllowance(requesterKey: string) {
  const sql = database();
  const rows = await sql`
    INSERT INTO generation_rate_limits (
      requester_key,
      window_started_at,
      request_count
    )
    VALUES (${requesterKey}, DATE_TRUNC('hour', NOW()), 1)
    ON CONFLICT (requester_key, window_started_at) DO UPDATE SET
      request_count = generation_rate_limits.request_count + 1
    RETURNING request_count
  `;
  const count = Number((rows[0] as { request_count?: number })?.request_count);
  if (!Number.isFinite(count) || count > 8) {
    throw new Error("Too many generation requests. Try again in an hour.");
  }
}

export async function getRestaurantByIdFresh(id: string) {
  const sql = database();
  const rows = await sql`SELECT * FROM restaurants WHERE id = ${id} LIMIT 1`;
  const row = rows[0] as RestaurantRow | undefined;
  return row ? recordFromRow(row) : undefined;
}

export const getRestaurantById = cache(getRestaurantByIdFresh);

async function findRestaurantBySlug(slug: string) {
  const sql = database();
  const rows = await sql`
    SELECT * FROM restaurants
    WHERE slug = ${slug} AND status = 'ready'
    LIMIT 1
  `;
  const row = rows[0] as RestaurantRow | undefined;
  return row ? recordFromRow(row) : undefined;
}

export const getRestaurantBySlug = cache(findRestaurantBySlug);

export async function claimRestaurantGeneration(
  id: string,
  retryFailed: boolean,
) {
  const sql = database();
  const leaseToken = crypto.randomUUID();
  const claimedRows = await sql`
    UPDATE restaurants
    SET
      status = 'generating',
      error = NULL,
      lease_token = ${leaseToken},
      lease_started_at = NOW(),
      generation_attempts = generation_attempts + 1,
      updated_at = NOW()
    WHERE id = ${id}
      AND generation_attempts < 4
      AND (
        status = 'pending'
        OR (status = 'failed' AND ${retryFailed})
        OR (
          status = 'generating'
          AND (
            lease_started_at IS NULL
            OR lease_started_at < NOW() - INTERVAL '5 minutes'
          )
        )
      )
    RETURNING *
  `;
  const claimed = claimedRows[0] as RestaurantRow | undefined;

  if (claimed) {
    return { claimed: true, leaseToken, record: recordFromRow(claimed) };
  }

  return {
    claimed: false,
    leaseToken: undefined,
    record: await getRestaurantByIdFresh(id),
  };
}

export async function checkpointProviderData(
  id: string,
  leaseToken: string,
  restaurant: Restaurant,
) {
  const sql = database();
  const rows = await sql`
    UPDATE restaurants
    SET provider_data = ${JSON.stringify(restaurant)}::jsonb, updated_at = NOW()
    WHERE id = ${id}
      AND status = 'generating'
      AND lease_token = ${leaseToken}
    RETURNING *
  `;
  const row = rows[0] as RestaurantRow | undefined;
  return row ? recordFromRow(row) : undefined;
}

async function slugIsAvailable(slug: string, id: string) {
  const sql = database();
  const rows = await sql`
    SELECT 1 FROM restaurants WHERE slug = ${slug} AND id <> ${id} LIMIT 1
  `;
  return rows.length === 0;
}

export async function completeRestaurantGeneration(
  id: string,
  leaseToken: string,
  baseSlug: string,
  restaurant: Restaurant,
) {
  const slug = (await slugIsAvailable(baseSlug, id))
    ? baseSlug
    : `${baseSlug}-${id.slice(0, 8)}`;
  let rows: Awaited<ReturnType<typeof saveCompletedRestaurant>>;

  try {
    rows = await saveCompletedRestaurant(id, leaseToken, slug, restaurant);
  } catch (error) {
    if (
      slug !== baseSlug ||
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "23505"
    ) {
      throw error;
    }

    rows = await saveCompletedRestaurant(
      id,
      leaseToken,
      `${baseSlug}-${id.slice(0, 8)}`,
      restaurant,
    );
  }

  const row = rows[0] as RestaurantRow | undefined;
  return row ? recordFromRow(row) : undefined;
}

async function saveCompletedRestaurant(
  id: string,
  leaseToken: string,
  slug: string,
  restaurant: Restaurant,
) {
  const sql = database();
  return sql`
    UPDATE restaurants
    SET
      canonical_url = ${restaurant.googleMapsUrl},
      slug = ${slug},
      place_id = ${restaurant.placeId ?? null},
      status = 'ready',
      data = ${JSON.stringify(restaurant)}::jsonb,
      provider_data = NULL,
      error = NULL,
      lease_token = NULL,
      lease_started_at = NULL,
      updated_at = NOW()
    WHERE id = ${id}
      AND status = 'generating'
      AND lease_token = ${leaseToken}
    RETURNING *
  `;
}

export async function failRestaurantGeneration(
  id: string,
  leaseToken: string,
  message: string,
) {
  const sql = database();
  const rows = await sql`
    UPDATE restaurants
    SET
      status = 'failed',
      error = ${message},
      lease_token = NULL,
      lease_started_at = NULL,
      updated_at = NOW()
    WHERE id = ${id}
      AND status = 'generating'
      AND lease_token = ${leaseToken}
    RETURNING *
  `;
  const row = rows[0] as RestaurantRow | undefined;
  return row ? recordFromRow(row) : undefined;
}
