"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  consumeGenerationAllowance,
  createRestaurantRecord,
} from "@/lib/database";
import { resolveGoogleMapsUrl } from "@/lib/restaurants";

async function requesterKey() {
  const requestHeaders = await headers();
  const forwardedFor =
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for") ??
    "local";
  const address = forwardedFor.split(",")[0]?.trim() || "local";
  return createHash("sha256").update(`limon:${address}`).digest("hex");
}

export async function generateRestaurant(formData: FormData) {
  const mapsUrl = String(formData.get("mapsUrl") ?? "").trim();
  let destination: string;

  try {
    await consumeGenerationAllowance(await requesterKey());
    const sourceUrl = await resolveGoogleMapsUrl(mapsUrl);
    const restaurant = await createRestaurantRecord(sourceUrl);
    destination =
      restaurant.status === "ready" && restaurant.slug
        ? `/${restaurant.slug}`
        : `/generating/${restaurant.id}`;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not read that Maps link.";
    destination = `/?error=${encodeURIComponent(message)}&maps=${encodeURIComponent(mapsUrl)}`;
  }

  redirect(destination);
}
