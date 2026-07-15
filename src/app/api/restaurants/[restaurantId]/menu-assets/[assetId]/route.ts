import { get } from "@vercel/blob";
import { requireMenuRepresentative } from "@/lib/menu-auth";
import { getAuthorizedMenuAsset } from "@/lib/menu-database";
import { privateMenuBlobToken } from "@/lib/menu-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string; assetId: string }> },
) {
  const { restaurantId, assetId } = await params;
  try {
    await requireMenuRepresentative(restaurantId);
    const asset = await getAuthorizedMenuAsset(restaurantId, assetId);
    if (!asset?.transformedBlobUrl)
      return new Response("Not found", { status: 404 });
    const result = await get(asset.transformedBlobUrl, {
      access: "private",
      token: privateMenuBlobToken(),
      useCache: false,
    });
    if (!result) return new Response("Not found", { status: 404 });
    return new Response(result.stream, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `${asset.mimeType === "application/pdf" ? "attachment" : "inline"}; filename=menu-source`,
        "content-type": asset.mimeType ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
}
