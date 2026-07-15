import "server-only";

import {
  claimMenuExtraction,
  completeMenuExtraction,
  failMenuExtraction,
  getMenuAssets,
  getMenuVersion,
} from "@/lib/menu-database";
import {
  DeterministicMenuExtractor,
  type MenuExtractor,
  mergeExtractionWithOwnerCorrections,
  validateMenuExtractionResult,
} from "@/lib/menus";

export async function generateMenuDraft(
  versionId: string,
  extractor: MenuExtractor = new DeterministicMenuExtractor(),
) {
  const leaseToken = await claimMenuExtraction(versionId);
  if (!leaseToken) return getMenuVersion(versionId);
  try {
    const [version, assets] = await Promise.all([
      getMenuVersion(versionId),
      getMenuAssets(versionId),
    ]);
    if (!version) throw new Error("Menu version was not found.");
    const result = validateMenuExtractionResult(
      await extractor.extract({
        menuVersionId: version.id,
        restaurantId: version.restaurantId,
        sourceAssets: assets.map((asset) => ({
          sourceAssetId: asset.id,
          pageIndex: asset.pageIndex,
        })),
      }),
      assets.map((asset) => asset.id),
    );
    const sections = mergeExtractionWithOwnerCorrections(
      version.sections,
      result.sections,
    );
    const completed = await completeMenuExtraction(
      versionId,
      leaseToken,
      sections,
      result.pipeline,
    );
    return completed ? getMenuVersion(versionId) : version;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Menu extraction failed.";
    await failMenuExtraction(versionId, leaseToken, message);
    return getMenuVersion(versionId);
  }
}
