import "server-only";

import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import { cache } from "react";
import { generatedMenus, generationRateLimits, restaurants } from "@/db/schema";
import { database } from "@/lib/db";
import type { GeneratedMenu } from "@/lib/menus";
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

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRestaurantId(value: string) {
  return UUID.test(value);
}

function recordFromRow(row: typeof restaurants.$inferSelect): RestaurantRecord {
  return {
    id: row.id,
    sourceUrl: row.sourceUrl,
    canonicalUrl: row.canonicalUrl ?? undefined,
    slug: row.slug ?? undefined,
    placeId: row.placeId ?? undefined,
    status: row.status,
    data: row.data ?? undefined,
    providerData: row.providerData ?? undefined,
    error: row.error ?? undefined,
    leaseToken: row.leaseToken ?? undefined,
    leaseStartedAt: row.leaseStartedAt?.toISOString(),
    generationAttempts: row.generationAttempts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createRestaurantRecord(sourceUrl: string) {
  const [row] = await database()
    .insert(restaurants)
    .values({ id: crypto.randomUUID(), sourceUrl })
    .onConflictDoUpdate({
      target: restaurants.sourceUrl,
      set: { updatedAt: new Date() },
    })
    .returning();
  return recordFromRow(row);
}

export async function consumeGenerationAllowance(requesterKey: string) {
  const windowStartedAt = new Date();
  windowStartedAt.setUTCMinutes(0, 0, 0);
  const [row] = await database()
    .insert(generationRateLimits)
    .values({ requesterKey, windowStartedAt })
    .onConflictDoUpdate({
      target: [
        generationRateLimits.requesterKey,
        generationRateLimits.windowStartedAt,
      ],
      set: {
        requestCount: sql`${generationRateLimits.requestCount} + 1`,
      },
    })
    .returning({ requestCount: generationRateLimits.requestCount });
  if (!row || row.requestCount > 8) {
    throw new Error("Demasiadas solicitudes. Intenta de nuevo en una hora.");
  }
}

export async function getRestaurantByIdFresh(id: string) {
  const row = await database().query.restaurants.findFirst({
    where: eq(restaurants.id, id),
  });
  return row ? recordFromRow(row) : undefined;
}

export const getRestaurantById = cache(getRestaurantByIdFresh);

async function findRestaurantBySlug(slug: string) {
  const row = await database().query.restaurants.findFirst({
    where: and(eq(restaurants.slug, slug), eq(restaurants.status, "ready")),
  });
  return row ? recordFromRow(row) : undefined;
}

export const getRestaurantBySlug = cache(findRestaurantBySlug);

export async function claimRestaurantGeneration(
  id: string,
  retryFailed: boolean,
) {
  const leaseToken = crypto.randomUUID();
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const [claimed] = await database()
    .update(restaurants)
    .set({
      status: "generating",
      error: null,
      leaseToken,
      leaseStartedAt: new Date(),
      generationAttempts: sql`${restaurants.generationAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(restaurants.id, id),
        lt(restaurants.generationAttempts, 4),
        or(
          eq(restaurants.status, "pending"),
          retryFailed ? eq(restaurants.status, "failed") : undefined,
          and(
            eq(restaurants.status, "generating"),
            or(
              sql`${restaurants.leaseStartedAt} is null`,
              lt(restaurants.leaseStartedAt, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning();

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
  const [row] = await database()
    .update(restaurants)
    .set({ providerData: restaurant, updatedAt: new Date() })
    .where(
      and(
        eq(restaurants.id, id),
        eq(restaurants.status, "generating"),
        eq(restaurants.leaseToken, leaseToken),
      ),
    )
    .returning();
  return row ? recordFromRow(row) : undefined;
}

async function slugIsAvailable(slug: string, id: string) {
  const row = await database().query.restaurants.findFirst({
    columns: { id: true },
    where: and(eq(restaurants.slug, slug), ne(restaurants.id, id)),
  });
  return !row;
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
  try {
    return await saveCompletedRestaurant(id, leaseToken, slug, restaurant);
  } catch (error) {
    if (slug !== baseSlug || !isUniqueViolation(error)) throw error;
    return saveCompletedRestaurant(
      id,
      leaseToken,
      `${baseSlug}-${id.slice(0, 8)}`,
      restaurant,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

async function saveCompletedRestaurant(
  id: string,
  leaseToken: string,
  slug: string,
  restaurant: Restaurant,
) {
  const [row] = await database()
    .update(restaurants)
    .set({
      canonicalUrl: restaurant.googleMapsUrl,
      slug,
      placeId: restaurant.placeId ?? null,
      status: "ready",
      data: restaurant,
      providerData: null,
      error: null,
      leaseToken: null,
      leaseStartedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(restaurants.id, id),
        eq(restaurants.status, "generating"),
        eq(restaurants.leaseToken, leaseToken),
      ),
    )
    .returning();
  return row ? recordFromRow(row) : undefined;
}

export async function failRestaurantGeneration(
  id: string,
  leaseToken: string,
  message: string,
) {
  const [row] = await database()
    .update(restaurants)
    .set({
      status: "failed",
      error: message,
      leaseToken: null,
      leaseStartedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(restaurants.id, id),
        eq(restaurants.status, "generating"),
        eq(restaurants.leaseToken, leaseToken),
      ),
    )
    .returning();
  return row ? recordFromRow(row) : undefined;
}

export async function saveGeneratedMenu(
  restaurantId: string,
  sourceImageUrls: string[],
  model: string,
  menu: GeneratedMenu,
) {
  await database()
    .insert(generatedMenus)
    .values({
      restaurantId,
      sourceImageUrls,
      model,
      status: "published",
      data: menu,
    })
    .onConflictDoUpdate({
      target: generatedMenus.restaurantId,
      set: {
        sourceImageUrls,
        model,
        status: "published",
        data: menu,
        error: null,
        updatedAt: new Date(),
      },
    });
}

export async function failGeneratedMenu(
  restaurantId: string,
  sourceImageUrls: string[],
  model: string,
  message: string,
) {
  await database()
    .insert(generatedMenus)
    .values({
      restaurantId,
      sourceImageUrls,
      model,
      status: "failed",
      error: message.slice(0, 500),
    })
    .onConflictDoUpdate({
      target: generatedMenus.restaurantId,
      set: {
        sourceImageUrls,
        model,
        status: "failed",
        data: null,
        error: message.slice(0, 500),
        updatedAt: new Date(),
      },
    });
}

export async function clearGeneratedMenu(restaurantId: string) {
  await database()
    .delete(generatedMenus)
    .where(eq(generatedMenus.restaurantId, restaurantId));
}

async function findPublishedMenu(restaurantId: string) {
  const row = await database().query.generatedMenus.findFirst({
    columns: { data: true },
    where: and(
      eq(generatedMenus.restaurantId, restaurantId),
      eq(generatedMenus.status, "published"),
    ),
  });
  return row?.data ?? undefined;
}

export const getPublishedMenu = cache(findPublishedMenu);
