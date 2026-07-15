import "server-only";

import {
  checkpointProviderData,
  claimRestaurantGeneration,
  completeRestaurantGeneration,
  failRestaurantGeneration,
  getRestaurantByIdFresh,
  type RestaurantRecord,
} from "@/lib/database";
import { assertBlobStorage, mirrorRestaurantMedia } from "@/lib/media";
import { importRestaurant, restaurantSlug } from "@/lib/restaurants";

export async function generateStoredRestaurant(
  id: string,
  retryFailed = false,
): Promise<RestaurantRecord> {
  const claim = await claimRestaurantGeneration(id, retryFailed);
  if (!claim.record)
    throw new Error("Restaurant generation record was not found.");
  if (!claim.claimed) return claim.record;
  const leaseToken = claim.leaseToken;
  if (!leaseToken)
    throw new Error("Restaurant generation lease was not created.");

  try {
    assertBlobStorage();
    let imported = claim.record.providerData;
    if (!imported) {
      imported = await importRestaurant(claim.record.sourceUrl);
      const checkpoint = await checkpointProviderData(
        claim.record.id,
        leaseToken,
        imported,
      );
      if (!checkpoint) {
        return (await getRestaurantByIdFresh(id)) ?? claim.record;
      }
    }
    const restaurant = await mirrorRestaurantMedia(
      imported,
      claim.record.id,
      leaseToken,
    );
    const completed = await completeRestaurantGeneration(
      claim.record.id,
      leaseToken,
      restaurantSlug(restaurant.name),
      restaurant,
    );
    return completed ?? (await getRestaurantByIdFresh(id)) ?? claim.record;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Restaurant generation failed.";
    const failed = await failRestaurantGeneration(
      claim.record.id,
      leaseToken,
      message,
    );
    return failed ?? (await getRestaurantByIdFresh(id)) ?? claim.record;
  }
}
