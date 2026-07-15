import "server-only";

import { createHash } from "node:crypto";
import { BlobNotFoundError, del, head, list, put } from "@vercel/blob";
import {
  assertDevelopmentMalwareScan,
  detectMenuMime,
  MAX_MENU_DIMENSION,
  MAX_MENU_FILE_BYTES,
  MAX_MENU_PAGES,
  MAX_MENU_PIXELS,
  type ValidatedMenuFile,
  validateMenuFile,
} from "@/lib/menu-files";

function storageToken() {
  const token = process.env.MENU_BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Private menu Blob storage is not configured.");
  return token;
}

export type MenuFileScan = {
  mimeType: ValidatedMenuFile["mimeType"];
  sha256: string;
  scanner: string;
  version: string;
};

async function processInIsolatedWorker(
  file: File,
  processorUrl: string,
): Promise<{ file: ValidatedMenuFile; scan: MenuFileScan }> {
  const processorToken = process.env.MENU_DOCUMENT_PROCESSOR_TOKEN;
  if (!processorToken) {
    throw new Error(
      "Isolated document processor authentication is not configured.",
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = detectMenuMime(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const response = await fetch(processorUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${processorToken}`,
      "content-type": "application/octet-stream",
      "x-content-sha256": sha256,
      "x-detected-content-type": mimeType,
    },
    body: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error("The isolated document processor did not accept the file.");
  const result = (await response.json()) as {
    clean?: boolean;
    safeToProcess?: boolean;
    scanner?: string;
    version?: string;
    transformedBase64?: string;
    widthPx?: number | null;
    heightPx?: number | null;
    pageCount?: number;
    perceptualHash?: string | null;
    transformations?: string[];
  };
  if (
    result.clean !== true ||
    result.safeToProcess !== true ||
    !result.scanner ||
    !result.version ||
    !result.transformedBase64 ||
    !Array.isArray(result.transformations)
  ) {
    throw new Error("The upload failed isolated document processing.");
  }
  const transformedBytes = Buffer.from(result.transformedBase64, "base64");
  if (
    transformedBytes.length < 1 ||
    transformedBytes.length > MAX_MENU_FILE_BYTES ||
    detectMenuMime(transformedBytes) !== mimeType
  ) {
    throw new Error(
      "The isolated processor returned an invalid transformation.",
    );
  }
  const pageCount = Number(result.pageCount);
  const widthPx = result.widthPx ?? null;
  const heightPx = result.heightPx ?? null;
  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > MAX_MENU_PAGES ||
    (mimeType !== "application/pdf" &&
      (!widthPx ||
        !heightPx ||
        widthPx > MAX_MENU_DIMENSION ||
        heightPx > MAX_MENU_DIMENSION ||
        widthPx * heightPx > MAX_MENU_PIXELS ||
        pageCount !== 1))
  ) {
    throw new Error("The isolated processor returned invalid dimensions.");
  }
  return {
    file: {
      originalName: file.name.slice(0, 180),
      mimeType,
      originalBytes: bytes,
      transformedBytes,
      widthPx,
      heightPx,
      pageCount,
      originalSha256: sha256,
      transformedSha256: createHash("sha256")
        .update(transformedBytes)
        .digest("hex"),
      perceptualHash: result.perceptualHash ?? null,
      transformations: result.transformations.slice(0, 20),
    },
    scan: {
      scanner: result.scanner,
      version: result.version,
      mimeType,
      sha256,
    },
  };
}

export async function processMenuUpload(file: File) {
  const processorUrl = process.env.MENU_DOCUMENT_PROCESSOR_URL;
  if (processorUrl) return processInIsolatedWorker(file, processorUrl);
  if (
    process.env.NODE_ENV === "production" ||
    process.env.MENU_ALLOW_DEVELOPMENT_SCANNER !== "true"
  ) {
    throw new Error("Isolated menu document processing is not configured.");
  }
  const validated = await validateMenuFile(file);
  return {
    file: validated,
    scan: {
      ...assertDevelopmentMalwareScan(validated.originalBytes),
      mimeType: validated.mimeType,
      sha256: validated.originalSha256,
    },
  };
}

export async function storePrivateMenuFile(
  restaurantId: string,
  versionId: string,
  file: ValidatedMenuFile,
  scan: MenuFileScan,
) {
  if (scan.sha256 !== file.originalSha256 || scan.mimeType !== file.mimeType) {
    throw new Error("The scanned file does not match the validated upload.");
  }
  const token = storageToken();
  const fileId = crypto.randomUUID();
  const base = `private-menus/${restaurantId}/${versionId}/${fileId}`;
  const original = await put(`${base}/original`, file.originalBytes, {
    access: "private",
    addRandomSuffix: false,
    contentType: file.mimeType,
    token,
  });
  try {
    const transformed = await put(
      `${base}/transformed`,
      file.transformedBytes,
      {
        access: "private",
        addRandomSuffix: false,
        contentType: file.mimeType,
        token,
      },
    );
    return {
      originalBlobUrl: original.url,
      transformedBlobUrl: transformed.url,
      malwareScanner: scan.scanner,
      malwareScannerVersion: scan.version,
    };
  } catch (error) {
    await del(original.url, { token }).catch(() => undefined);
    throw error;
  }
}

export async function deletePrivateMenuBlobs(urls: string[]) {
  if (urls.length === 0) return;
  const token = storageToken();
  await del(urls, { token });
  await Promise.all(
    urls.map(async (url) => {
      try {
        await head(url, { token });
        throw new Error("A deleted menu object is still accessible.");
      } catch (error) {
        if (!(error instanceof BlobNotFoundError)) throw error;
      }
    }),
  );
}

export async function deletePrivateMenuUploadBatch(
  restaurantId: string,
  batchId: string,
) {
  const token = storageToken();
  const result = await list({
    prefix: `private-menus/${restaurantId}/${batchId}/`,
    token,
  });
  if (result.blobs.length > 0) {
    await deletePrivateMenuBlobs(result.blobs.map((blob) => blob.url));
  }
}

export function privateMenuBlobToken() {
  return storageToken();
}
