import { requireMenuRepresentative } from "@/lib/menu-auth";
import {
  createMenuUpload,
  createMenuUploadBatch,
  type StoredAssetInput,
  setMenuUploadBatchStatus,
} from "@/lib/menu-database";
import { assertMenuUploadTotals, MAX_MENU_PAGES } from "@/lib/menu-files";
import { generateMenuDraft } from "@/lib/menu-generation";
import {
  deletePrivateMenuUploadBatch,
  processMenuUpload,
  storePrivateMenuFile,
} from "@/lib/menu-storage";
import { DETERMINISTIC_PIPELINE, validateRightsGrant } from "@/lib/menus";

function redirectToManage(
  request: Request,
  restaurantId: string,
  type: string,
  text: string,
) {
  const url = new URL(`/manage/${restaurantId}`, request.url);
  url.searchParams.set(type, text);
  return Response.redirect(url, 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  const { restaurantId } = await params;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return new Response("Invalid request origin.", { status: 403 });
  }
  let uploadBatchId: string | undefined;
  try {
    const representative = await requireMenuRepresentative(restaurantId);
    const formData = await request.formData();
    if (formData.get("ownershipConfirmed") !== "yes") {
      throw new Error("The asset ownership representation is required.");
    }
    const retentionClass = String(formData.get("retentionClass") ?? "");
    const rawDeleteAfter = String(formData.get("deleteAfter") ?? "").trim();
    const deleteAfter = rawDeleteAfter
      ? new Date(rawDeleteAfter).toISOString()
      : null;
    const rights = {
      grantorId: String(formData.get("grantorId") ?? "").trim(),
      signerAuthority: String(formData.get("signerAuthority") ?? "").trim(),
      ownershipRepresentation: String(
        formData.get("ownershipRepresentation") ?? "",
      ),
      scopes: formData.getAll("scope").map(String),
      retentionClass,
      deleteAfter,
    };
    validateRightsGrant(rights);
    const files = formData
      .getAll("files")
      .filter(
        (value): value is File => value instanceof File && value.size > 0,
      );
    assertMenuUploadTotals(files);
    uploadBatchId = crypto.randomUUID();
    await createMenuUploadBatch(uploadBatchId, restaurantId, representative.id);
    const validated: Awaited<ReturnType<typeof processMenuUpload>>[] = [];
    let pageCount = 0;
    const hashes = new Set<string>();
    for (const file of files) {
      const result = await processMenuUpload(file);
      if (hashes.has(result.file.originalSha256)) continue;
      hashes.add(result.file.originalSha256);
      pageCount += result.file.pageCount;
      if (pageCount > MAX_MENU_PAGES) {
        throw new Error(`A menu can contain at most ${MAX_MENU_PAGES} pages.`);
      }
      validated.push(result);
    }
    if (validated.length === 0)
      throw new Error("All uploaded files were duplicates.");

    const assets: StoredAssetInput[] = [];
    let pageIndex = 0;
    for (const validatedFile of validated) {
      const { file, scan } = validatedFile;
      const stored = await storePrivateMenuFile(
        restaurantId,
        uploadBatchId,
        file,
        scan,
      );
      for (let sourcePage = 0; sourcePage < file.pageCount; sourcePage += 1) {
        assets.push({
          id: crypto.randomUUID(),
          pageIndex,
          originalName:
            file.pageCount > 1
              ? `${file.originalName} (page ${sourcePage + 1})`
              : file.originalName,
          mimeType: file.mimeType,
          byteSize: file.originalBytes.byteLength,
          widthPx: file.widthPx,
          heightPx: file.heightPx,
          pageCount: file.pageCount,
          originalSha256: file.originalSha256,
          transformedSha256: file.transformedSha256,
          perceptualHash: file.perceptualHash,
          originalBlobUrl: stored.originalBlobUrl,
          transformedBlobUrl: stored.transformedBlobUrl,
          transformations: file.transformations,
          malwareScanner: stored.malwareScanner,
          malwareScannerVersion: stored.malwareScannerVersion,
        });
        pageIndex += 1;
      }
    }
    const upload = await createMenuUpload({
      uploadBatchId,
      restaurantId,
      representativeId: representative.id,
      ...rights,
      pipeline: DETERMINISTIC_PIPELINE,
      assets,
    });
    await generateMenuDraft(upload.versionId);
    return redirectToManage(
      request,
      restaurantId,
      "message",
      "Draft created. Review every field before approval.",
    );
  } catch (error) {
    if (uploadBatchId) {
      try {
        await deletePrivateMenuUploadBatch(restaurantId, uploadBatchId);
        await setMenuUploadBatchStatus(uploadBatchId, "cleaned");
      } catch (cleanupError) {
        await setMenuUploadBatchStatus(
          uploadBatchId,
          "cleanup_pending",
          cleanupError instanceof Error
            ? cleanupError.message
            : "Upload cleanup failed.",
        ).catch(() => undefined);
      }
    }
    return redirectToManage(
      request,
      restaurantId,
      "error",
      error instanceof Error ? error.message : "Menu upload failed.",
    );
  }
}
