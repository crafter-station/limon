import "server-only";

import { put } from "@vercel/blob";
import type { Restaurant } from "@/lib/restaurants";

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MEDIA_HOST = /(^|\.)googleusercontent\.com$/i;
const CONTENT_TYPES = new Map([
  ["image/avif", "avif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function assertBlobStorage() {
  const hasOidc = process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID;
  if (!process.env.BLOB_READ_WRITE_TOKEN && !hasOidc) {
    throw new Error("El almacenamiento de imágenes no está configurado.");
  }
}

function validatedMediaUrl(value: string | URL) {
  const url = value instanceof URL ? value : new URL(value);
  if (
    url.protocol !== "https:" ||
    (!MEDIA_HOST.test(url.hostname) &&
      url.hostname !== "streetviewpixels-pa.googleapis.com")
  ) {
    throw new Error("Esa imagen viene de un origen no permitido.");
  }

  return url;
}

async function fetchMedia(source: string) {
  let url = validatedMediaUrl(source);

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location)
      throw new Error("La imagen devolvió una redirección inválida.");
    url = validatedMediaUrl(new URL(location, url));
  }

  throw new Error("La imagen redirigió demasiadas veces.");
}

async function readLimitedBody(response: Response) {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_MEDIA_BYTES) {
    throw new Error("La imagen es demasiado grande.");
  }
  if (!response.body) throw new Error("La imagen llegó sin contenido.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MEDIA_BYTES) {
      await reader.cancel();
      throw new Error("La imagen es demasiado grande.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function copyImage(source: string, pathname: string) {
  const response = await fetchMedia(source);
  if (!response.ok)
    throw new Error(
      `No se pudo descargar la imagen (código ${response.status}).`,
    );

  const contentType = response.headers.get("content-type")?.split(";")[0];
  const extension = contentType ? CONTENT_TYPES.get(contentType) : undefined;
  if (!contentType || !extension)
    throw new Error("Ese formato de imagen no es compatible.");

  const bytes = await readLimitedBody(response);

  return put(`${pathname}.${extension}`, Buffer.from(bytes), {
    access: "public",
    allowOverwrite: true,
    cacheControlMaxAge: 31_536_000,
    contentType,
  });
}

async function mapWithConcurrency<Input, Output>(
  items: Input[],
  concurrency: number,
  operation: (item: Input, index: number) => Promise<Output>,
) {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function optionalCopy(source: string | undefined, pathname: string) {
  if (!source) return undefined;

  try {
    return await copyImage(source, pathname);
  } catch {
    return undefined;
  }
}

export async function mirrorRestaurantMedia(
  restaurant: Restaurant,
  restaurantId: string,
  leaseToken: string,
): Promise<Restaurant> {
  assertBlobStorage();

  const photos = await mapWithConcurrency(
    restaurant.photos,
    3,
    async (photo, index) => {
      const blob = await optionalCopy(
        photo.url,
        `restaurants/${restaurantId}/runs/${leaseToken}/photos/${index + 1}`,
      );
      return blob ? { ...photo, url: blob.url } : undefined;
    },
  );
  const preservedPhotos = photos.flatMap((photo) => (photo ? [photo] : []));
  if (restaurant.photos.length > 0 && preservedPhotos.length === 0) {
    throw new Error("No pudimos guardar las fotos del restaurante.");
  }
  const reviews = await mapWithConcurrency(
    restaurant.reviews,
    2,
    async (review, reviewIndex) => {
      const avatar = await optionalCopy(
        review.avatarUrl,
        `restaurants/${restaurantId}/runs/${leaseToken}/reviews/${reviewIndex + 1}-avatar`,
      );
      const images = await mapWithConcurrency(
        review.imageUrls ?? [],
        2,
        (url, imageIndex) =>
          optionalCopy(
            url,
            `restaurants/${restaurantId}/runs/${leaseToken}/reviews/${reviewIndex + 1}-${imageIndex + 1}`,
          ),
      );

      return {
        ...review,
        avatarUrl: avatar?.url,
        imageUrls: images.flatMap((image) => (image ? [image.url] : [])),
      };
    },
  );

  return {
    ...restaurant,
    photos: preservedPhotos,
    reviews,
  };
}
