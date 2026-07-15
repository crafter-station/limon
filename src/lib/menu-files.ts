import { createHash } from "node:crypto";
import sharp from "sharp";

export const MAX_MENU_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_MENU_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_MENU_PAGES = 20;
export const MAX_MENU_PIXELS = 25_000_000;
export const MAX_MENU_DIMENSION = 12_000;

export type ValidatedMenuFile = {
  originalName: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  originalBytes: Buffer;
  transformedBytes: Buffer;
  widthPx: number | null;
  heightPx: number | null;
  pageCount: number;
  originalSha256: string;
  transformedSha256: string;
  perceptualHash: string | null;
  transformations: string[];
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function detectMenuMime(
  bytes: Uint8Array,
): ValidatedMenuFile["mimeType"] {
  if (
    bytes.length >= 5 &&
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
  ) {
    return "application/pdf";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  throw new Error("Upload a static JPEG, PNG, WebP, or PDF menu.");
}

function validatePdf(bytes: Buffer) {
  const text = bytes
    .toString("latin1")
    .replace(/#([0-9a-f]{2})/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  if (!/%%EOF\s*$/.test(text.slice(-2048))) {
    throw new Error("The PDF is incomplete or malformed.");
  }
  if (
    /\/(?:JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|ObjStm|Encrypt)\b/i.test(
      text,
    )
  ) {
    throw new Error("Active or embedded PDF content is not supported.");
  }
  const pageCount = text.match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
  if (pageCount < 1 || pageCount > MAX_MENU_PAGES) {
    throw new Error(`PDF menus must contain 1 to ${MAX_MENU_PAGES} pages.`);
  }
  return pageCount;
}

async function perceptualHash(bytes: Buffer) {
  const { data } = await sharp(bytes)
    .rotate()
    .resize(8, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const average = data.reduce((sum, value) => sum + value, 0) / data.length;
  let bits = "";
  for (const value of data) bits += value >= average ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

export async function validateMenuFile(file: File): Promise<ValidatedMenuFile> {
  if (file.size < 1 || file.size > MAX_MENU_FILE_BYTES) {
    throw new Error(
      `Each menu file must be at most ${MAX_MENU_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }
  const startedAt = Date.now();
  const originalBytes = Buffer.from(await file.arrayBuffer());
  const mimeType = detectMenuMime(originalBytes);
  const originalSha256 = sha256(originalBytes);

  if (mimeType === "application/pdf") {
    const pageCount = validatePdf(originalBytes);
    return {
      originalName: file.name.slice(0, 180),
      mimeType,
      originalBytes,
      transformedBytes: originalBytes,
      widthPx: null,
      heightPx: null,
      pageCount,
      originalSha256,
      transformedSha256: originalSha256,
      perceptualHash: null,
      transformations: ["identity; active-content check passed"],
    };
  }

  if (
    mimeType === "image/webp" &&
    /(?:ANIM|ANMF)/.test(originalBytes.toString("latin1"))
  ) {
    throw new Error("Animated menu images are not supported.");
  }
  const image = sharp(originalBytes, {
    animated: false,
    limitInputPixels: MAX_MENU_PIXELS,
  });
  const metadata = await image.metadata();
  const widthPx = metadata.width ?? 0;
  const heightPx = metadata.height ?? 0;
  if (
    !widthPx ||
    !heightPx ||
    widthPx > MAX_MENU_DIMENSION ||
    heightPx > MAX_MENU_DIMENSION ||
    widthPx * heightPx > MAX_MENU_PIXELS
  ) {
    throw new Error("Menu image dimensions exceed the processing limit.");
  }
  if ((metadata.pages ?? 1) !== 1) {
    throw new Error("Animated or multi-page images are not supported.");
  }
  const normalized = sharp(originalBytes, { limitInputPixels: MAX_MENU_PIXELS })
    .rotate()
    .toColorspace("srgb")
    .withMetadata({ orientation: undefined });
  const transformedBytes =
    mimeType === "image/jpeg"
      ? await normalized.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
      : mimeType === "image/png"
        ? await normalized.png({ compressionLevel: 9 }).toBuffer()
        : await normalized.webp({ quality: 92 }).toBuffer();
  if (Date.now() - startedAt > 30_000) {
    throw new Error("Menu preprocessing exceeded its time limit.");
  }
  return {
    originalName: file.name.slice(0, 180),
    mimeType,
    originalBytes,
    transformedBytes,
    widthPx,
    heightPx,
    pageCount: 1,
    originalSha256,
    transformedSha256: sha256(transformedBytes),
    perceptualHash: await perceptualHash(transformedBytes),
    transformations: ["auto-orient", "sRGB", "metadata stripped"],
  };
}

export function assertMenuUploadTotals(files: File[]) {
  if (files.length < 1 || files.length > MAX_MENU_PAGES) {
    throw new Error(`Upload between 1 and ${MAX_MENU_PAGES} menu files.`);
  }
  const bytes = files.reduce((total, file) => total + file.size, 0);
  if (bytes > MAX_MENU_TOTAL_BYTES) {
    throw new Error(
      `Menu uploads are limited to ${MAX_MENU_TOTAL_BYTES / 1024 / 1024} MB total.`,
    );
  }
}

export function assertDevelopmentMalwareScan(bytes: Uint8Array) {
  if (
    Buffer.from(bytes).includes(
      Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"),
    )
  ) {
    throw new Error("The upload failed malware scanning.");
  }
  return { scanner: "limon-development-signature", version: "1" };
}
