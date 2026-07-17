import "server-only";

import {
  checkpointProviderData,
  claimRestaurantGeneration,
  clearGeneratedMenu,
  completeRestaurantGeneration,
  failGeneratedMenu,
  failRestaurantGeneration,
  getRestaurantByIdFresh,
  type RestaurantRecord,
  saveGeneratedMenu,
} from "@/lib/database";
import { assertBlobStorage, mirrorRestaurantMedia } from "@/lib/media";
import {
  extractMenuFromImages,
  MENU_VISION_MODEL,
} from "@/lib/menu-generation";
import type { GeneratedMenu } from "@/lib/menus";
import { importRestaurant, restaurantSlug } from "@/lib/restaurants";

export async function generateStoredRestaurant(
  id: string,
  retryFailed = false,
): Promise<RestaurantRecord> {
  const claim = await claimRestaurantGeneration(id, retryFailed);
  if (!claim.record)
    throw new Error("No encontramos el registro de esta generación.");
  if (!claim.claimed) return claim.record;
  const leaseToken = claim.leaseToken;
  if (!leaseToken) throw new Error("No pudimos iniciar esta generación.");

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
    let menu: GeneratedMenu | undefined;
    let menuError: string | undefined;
    let sourceImageUrls: string[] = [];
    if (restaurant.importedWith === "apify" && restaurant.photos.length > 0) {
      sourceImageUrls = restaurant.photos
        .slice(0, 10)
        .map((photo) => photo.url);
      try {
        menu = await extractMenuFromImages(restaurant.name, sourceImageUrls);
      } catch (error) {
        menuError =
          error instanceof Error
            ? error.message
            : "No pudimos leer el menú de las fotos.";
      }
    }
    const completed = await completeRestaurantGeneration(
      claim.record.id,
      leaseToken,
      restaurantSlug(restaurant.name),
      restaurant,
    );
    if (!completed) return (await getRestaurantByIdFresh(id)) ?? claim.record;

    if (menu) {
      await saveGeneratedMenu(
        claim.record.id,
        sourceImageUrls,
        MENU_VISION_MODEL,
        menu,
      );
    } else if (menuError) {
      await failGeneratedMenu(
        claim.record.id,
        sourceImageUrls,
        MENU_VISION_MODEL,
        menuError,
      );
    } else {
      await clearGeneratedMenu(claim.record.id);
    }
    return completed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No pudimos terminar tu web.";
    const failed = await failRestaurantGeneration(
      claim.record.id,
      leaseToken,
      message,
    );
    return failed ?? (await getRestaurantByIdFresh(id)) ?? claim.record;
  }
}
