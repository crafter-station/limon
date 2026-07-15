import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { GeneratedMenu } from "@/lib/menus";
import type { Restaurant } from "@/lib/restaurants";

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").primaryKey(),
    sourceUrl: text("source_url")
      .notNull()
      .unique("restaurants_source_url_key"),
    canonicalUrl: text("canonical_url"),
    slug: text("slug").unique("restaurants_slug_key"),
    placeId: text("place_id"),
    status: text("status")
      .$type<"failed" | "generating" | "pending" | "ready">()
      .notNull()
      .default("pending"),
    data: jsonb("data").$type<Restaurant>(),
    providerData: jsonb("provider_data").$type<Restaurant>(),
    error: text("error"),
    leaseToken: uuid("lease_token"),
    leaseStartedAt: timestamp("lease_started_at", { withTimezone: true }),
    generationAttempts: integer("generation_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("restaurants_status_idx").on(table.status),
    index("restaurants_place_id_idx").on(table.placeId),
    check(
      "restaurants_status_check",
      sql`${table.status} in ('pending', 'generating', 'ready', 'failed')`,
    ),
    check(
      "restaurants_ready_data_check",
      sql`${table.status} <> 'ready' or (${table.slug} is not null and ${table.data} is not null)`,
    ),
  ],
);

export const generationRateLimits = pgTable(
  "generation_rate_limits",
  {
    requesterKey: text("requester_key").notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.requesterKey, table.windowStartedAt] }),
  ],
);

export const generatedMenus = pgTable(
  "generated_menus",
  {
    restaurantId: uuid("restaurant_id")
      .primaryKey()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"failed" | "processing" | "published">()
      .notNull()
      .default("processing"),
    data: jsonb("data").$type<GeneratedMenu>(),
    sourceImageUrls: jsonb("source_image_urls").$type<string[]>().notNull(),
    model: text("model").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "generated_menus_status_check",
      sql`${table.status} in ('processing', 'published', 'failed')`,
    ),
    check(
      "generated_menus_published_data_check",
      sql`${table.status} <> 'published' or ${table.data} is not null`,
    ),
  ],
);
