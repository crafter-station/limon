import { cache } from "react";

export type RestaurantPhoto = {
  url: string;
  author?: string;
  authorUrl?: string;
  uploadedAt?: string;
};

export type RestaurantReview = {
  id?: string;
  author: string;
  authorUrl?: string;
  avatarUrl?: string;
  rating: number;
  text: string;
  relativeTime?: string;
  publishedAt?: string;
  googleMapsUrl?: string;
  likes?: number;
  ownerResponse?: string;
  imageUrls?: string[];
};

export type Restaurant = {
  name: string;
  category: string;
  address: string;
  city?: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  openingStatus?: string;
  openingHours: string[];
  description: string;
  photos: RestaurantPhoto[];
  reviews: RestaurantReview[];
  googleMapsUrl: string;
  importedWith: "apify" | "google-maps-preview" | "places-api";
  details?: Record<string, unknown>;
};

const MAPS_HOST =
  /^(?:(?:maps|www)\.)?google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/i;
const SHORT_MAPS_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);
const REQUEST_HEADERS = {
  "accept-language": "es-419,es;q=0.9,en;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
};

function isGoogleMapsUrl(url: URL) {
  return (
    SHORT_MAPS_HOSTS.has(url.hostname) ||
    (MAPS_HOST.test(url.hostname) &&
      (url.pathname.startsWith("/maps") || url.hostname.startsWith("maps.")))
  );
}

function validatedMapsUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Pega una URL completa de Google Maps, incluyendo https://.",
    );
  }

  if (url.protocol !== "https:" || !isGoogleMapsUrl(url)) {
    throw new Error("Revisa que el link sea de un lugar en Google Maps.");
  }

  return url;
}

export function validateGoogleMapsUrl(value: string) {
  return normalizedMapsUrl(validatedMapsUrl(value)).toString();
}

function normalizedMapsUrl(url: URL) {
  const normalized = new URL(url);
  const identityParameters = new Set([
    "api",
    "cid",
    "ftid",
    "q",
    "query",
    "query_place_id",
  ]);
  normalized.hash = "";
  for (const key of [...normalized.searchParams.keys()]) {
    if (!identityParameters.has(key)) normalized.searchParams.delete(key);
  }
  return normalized;
}

export async function resolveGoogleMapsUrl(value: string) {
  const initialUrl = validatedMapsUrl(value);
  const { response, url } = await fetchGoogleMapsUrl(initialUrl);
  if (!response.ok) throw new Error("Google Maps no devolvió ese restaurante.");
  await response.body?.cancel();
  return normalizedMapsUrl(url).toString();
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseNameFromUrl(url: URL) {
  const encodedName = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1];
  if (!encodedName) return "Local restaurant";

  try {
    return decodeURIComponent(encodedName.replaceAll("+", " "));
  } catch {
    return encodedName.replaceAll("+", " ");
  }
}

function parseCoordinates(url: URL) {
  const match = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return {};

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

function collectStrings(value: unknown, result: string[] = []) {
  if (typeof value === "string") {
    result.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, result);
  }

  return result;
}

function normalizePhotoUrl(url: string) {
  return url.replace(/=w\d+-h\d+.*$/, "=w1600-h1200-k-no");
}

function extractPhotos(value: unknown, author?: string) {
  const photos = new Map<string, RestaurantPhoto>();

  for (const item of collectStrings(value)) {
    if (
      !/^https:\/\/(lh\d+\.googleusercontent\.com|streetviewpixels-pa\.googleapis\.com)\//.test(
        item,
      )
    ) {
      continue;
    }

    const key = item.split("=")[0];
    if (!photos.has(key)) {
      photos.set(key, { url: normalizePhotoUrl(item), author });
    }
  }

  return [...photos.values()].slice(0, 10);
}

function generatedDescription(name: string, category: string, city?: string) {
  const location = city ? ` en ${city}` : "";
  return `${name} es ${category.toLowerCase()} local${location}, un lugar para reunirse alrededor de sabores frescos y una mesa bien servida. Visitanos para disfrutar la especialidad de la casa y la hospitalidad de siempre.`;
}

async function fetchMapsDocument(input: string) {
  const initialUrl = validatedMapsUrl(input);
  const { response, url: finalUrl } = await fetchGoogleMapsUrl(initialUrl);

  if (!response.ok) {
    throw new Error("Google Maps no devolvió ese restaurante.");
  }

  return { finalUrl, html: await response.text() };
}

async function fetchGoogleMapsUrl(initialUrl: URL) {
  let url = initialUrl;

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetch(url, {
      cache: "no-store",
      headers: REQUEST_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status < 300 || response.status >= 400) {
      return { response, url };
    }

    const location = response.headers.get("location");
    if (!location)
      throw new Error("Google Maps devolvió una redirección inválida.");
    url = validatedMapsUrl(new URL(location, url).toString());
  }

  throw new Error("Google Maps redirigió demasiadas veces.");
}

async function scrapeGoogleMaps(input: string): Promise<Restaurant> {
  const { finalUrl, html } = await fetchMapsDocument(input);
  const fallbackName = parseNameFromUrl(finalUrl);
  const fallbackCoordinates = parseCoordinates(finalUrl);
  const previewHref = html
    .match(/href="([^"]*\/maps\/preview\/place\?[^"]+)"/i)?.[1]
    ?.replaceAll("&amp;", "&");

  if (!previewHref) {
    return {
      name: fallbackName,
      category: "Restaurante",
      address: "Consulta la ubicacion en Google Maps",
      ...fallbackCoordinates,
      openingHours: [],
      description: generatedDescription(fallbackName, "Restaurante"),
      photos: [],
      reviews: [],
      googleMapsUrl: finalUrl.toString(),
      importedWith: "google-maps-preview",
    };
  }

  const previewUrl = validatedMapsUrl(
    new URL(previewHref, finalUrl.origin).toString(),
  );
  const { response: previewResponse } = await fetchGoogleMapsUrl(previewUrl);

  if (!previewResponse.ok) {
    throw new Error(
      "Los detalles de Google Maps no están disponibles por ahora.",
    );
  }

  const previewText = await previewResponse.text();
  const jsonStart = previewText.indexOf("\n");
  const payload = JSON.parse(previewText.slice(jsonStart + 1)) as unknown;
  const root = asArray(payload);
  const place = asArray(root?.[6]);

  if (!place) {
    throw new Error("Encontramos el lugar, pero no pudimos leer sus detalles.");
  }

  const addressParts = asArray(place[2]);
  const ratingData = asArray(place[4]);
  const location = asArray(place[9]);
  const categories = asArray(place[13]);
  const owner = asArray(place[57]);
  const phoneEntries = asArray(place[178]);
  const firstPhone = asArray(phoneEntries?.[0]);
  const websiteData = asArray(place[7]);
  const placeIds = asArray(place[227]);
  const firstPlaceIds = asArray(placeIds?.[0]);
  const name = asString(place[11]) ?? fallbackName;
  const category = asString(categories?.[0]) ?? "Restaurante";
  const address =
    asString(place[39]) ??
    asString(place[18]) ??
    addressParts?.map(asString).filter(Boolean).join(", ") ??
    "Consulta la ubicacion en Google Maps";
  const city = asString(place[166]);
  const status = collectStrings(place[203]).find((text) =>
    /Abre|Cierra|Cerrado|Abierto/i.test(text),
  );
  const photoAuthor = asString(owner?.[1]);

  return {
    name,
    category,
    address,
    city,
    phone: asString(firstPhone?.[0]),
    website: asString(websiteData?.[0]) ?? asString(place[7]),
    latitude: asNumber(location?.[2]) ?? fallbackCoordinates.latitude,
    longitude: asNumber(location?.[3]) ?? fallbackCoordinates.longitude,
    placeId: asString(place[78]) ?? asString(firstPlaceIds?.[4]),
    rating: asNumber(ratingData?.[7]),
    reviewCount: asNumber(ratingData?.[8]),
    openingStatus: status,
    openingHours: [],
    description: generatedDescription(name, category, city),
    photos: extractPhotos(place[72], photoAuthor),
    reviews: [],
    googleMapsUrl: asString(place[42]) ?? finalUrl.toString(),
    importedWith: "google-maps-preview",
  };
}

type GoogleText = { text?: string };
type GoogleAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};
type GooglePhoto = { name?: string; authorAttributions?: GoogleAttribution[] };
type GoogleReview = {
  authorAttribution?: GoogleAttribution;
  rating?: number;
  text?: GoogleText;
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
};
type GooglePlace = {
  id?: string;
  displayName?: GoogleText;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: GoogleText;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: GoogleText;
  currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: GooglePhoto[];
  reviews?: GoogleReview[];
};

type ApifyImage = {
  imageUrl?: string;
  authorName?: string;
  authorUrl?: string;
  uploadedAt?: string;
};

type ApifyReview = {
  name?: string;
  text?: string;
  publishAt?: string;
  publishedAtDate?: string;
  likesCount?: number;
  reviewId?: string;
  reviewUrl?: string;
  reviewerUrl?: string;
  reviewerPhotoUrl?: string;
  stars?: number;
  responseFromOwnerText?: string;
  reviewImageUrls?: string[];
};

type ApifyPlace = {
  title?: string;
  description?: string;
  categoryName?: string;
  categories?: string[];
  address?: string;
  city?: string;
  website?: string;
  phone?: string;
  location?: { lat?: number; lng?: number };
  totalScore?: number;
  reviewsCount?: number;
  placeId?: string;
  cid?: string;
  fid?: string;
  kgmid?: string;
  price?: string;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  openingHours?: { day?: string; hours?: string }[];
  additionalInfo?: Record<string, unknown>;
  reviewsDistribution?: Record<string, number>;
  imagesCount?: number;
  images?: ApifyImage[];
  imageUrls?: string[];
  reviews?: ApifyReview[];
  menu?: string;
  reserveTableUrl?: string;
  tableReservationLinks?: unknown[];
  bookingLinks?: unknown[];
  restaurantData?: Record<string, unknown>;
  scrapedAt?: string;
  url?: string;
};

export function mapApifyRestaurant(
  place: ApifyPlace,
  fallback: Restaurant,
): Restaurant {
  const name = place.title?.trim() || fallback.name;
  const category = place.categoryName?.trim() || fallback.category;
  const photos = (place.images ?? []).flatMap((image) => {
    if (!image.imageUrl) return [];

    return [
      {
        url: image.imageUrl,
        author: image.authorName,
        authorUrl: image.authorUrl,
        uploadedAt: image.uploadedAt,
      },
    ];
  });
  const fallbackPhotos = (place.imageUrls ?? []).map((url) => ({ url }));
  const reviews = (place.reviews ?? []).flatMap((review) => {
    const text = review.text?.trim();
    if (!text) return [];

    return [
      {
        id: review.reviewId,
        author: review.name?.trim() || "Google Maps user",
        authorUrl: review.reviewerUrl,
        avatarUrl: review.reviewerPhotoUrl,
        rating: review.stars ?? 5,
        text,
        relativeTime: review.publishAt,
        publishedAt: review.publishedAtDate,
        googleMapsUrl: review.reviewUrl,
        likes: review.likesCount,
        ownerResponse: review.responseFromOwnerText,
        imageUrls: review.reviewImageUrls,
      },
    ];
  });
  const openingHours = (place.openingHours ?? []).flatMap((entry) => {
    if (!entry.day || !entry.hours) return [];
    return [`${entry.day}: ${entry.hours}`];
  });
  const openingStatus = place.permanentlyClosed
    ? "Cerrado permanentemente"
    : place.temporarilyClosed
      ? "Cerrado temporalmente"
      : fallback.openingStatus;

  return {
    ...fallback,
    name,
    category,
    address: place.address?.trim() || fallback.address,
    city: place.city?.trim() || fallback.city,
    phone: place.phone?.trim() || fallback.phone,
    website: place.website?.trim() || fallback.website,
    latitude: place.location?.lat ?? fallback.latitude,
    longitude: place.location?.lng ?? fallback.longitude,
    placeId: place.placeId ?? fallback.placeId,
    rating: place.totalScore ?? fallback.rating,
    reviewCount: place.reviewsCount ?? fallback.reviewCount,
    openingStatus,
    openingHours:
      openingHours.length > 0 ? openingHours : fallback.openingHours,
    description:
      place.description?.trim() ||
      generatedDescription(name, category, place.city),
    photos:
      photos.length > 0
        ? photos
        : fallbackPhotos.length > 0
          ? fallbackPhotos
          : fallback.photos,
    reviews: reviews.length > 0 ? reviews : fallback.reviews,
    googleMapsUrl: place.url ?? fallback.googleMapsUrl,
    importedWith: "apify",
    details: {
      cid: place.cid,
      fid: place.fid,
      kgmid: place.kgmid,
      categories: place.categories,
      price: place.price,
      imageCount: place.imagesCount,
      reviewsDistribution: place.reviewsDistribution,
      additionalInfo: place.additionalInfo,
      menuUrl: place.menu,
      reserveTableUrl: place.reserveTableUrl,
      tableReservationLinks: place.tableReservationLinks,
      bookingLinks: place.bookingLinks,
      restaurantData: place.restaurantData,
      scrapedAt: place.scrapedAt,
    },
  };
}

async function enrichWithApify(
  scraped: Restaurant,
  token: string,
  sourceUrl: string,
): Promise<Restaurant> {
  const response = await fetch(
    "https://api.apify.com/v2/actors/compass~crawler-google-places/run-sync-get-dataset-items?clean=true&maxTotalChargeUsd=0.5&timeout=120",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startUrls: [{ url: sourceUrl }],
        language: "es",
        scrapePlaceDetailPage: true,
        maxReviews: 5,
        reviewsSort: "mostRelevant",
        reviewsOrigin: "google",
        scrapeReviewsPersonalData: true,
        maxImages: 10,
        scrapeImageAuthors: true,
        maxQuestions: 0,
        scrapeContacts: false,
        maximumLeadsEnrichmentRecords: 0,
      }),
      signal: AbortSignal.timeout(125_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `La importación con Apify falló (código ${response.status}).`,
    );
  }

  const places = (await response.json()) as ApifyPlace[];
  const place = places[0];
  if (!place) throw new Error("Apify no encontró información del restaurante.");

  return mapApifyRestaurant(place, scraped);
}

async function resolvePlacePhoto(
  photo: GooglePhoto,
  apiKey: string,
): Promise<RestaurantPhoto | undefined> {
  if (!photo.name) return undefined;

  const response = await fetch(
    `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=1600&skipHttpRedirect=true`,
    {
      cache: "no-store",
      headers: { "X-Goog-Api-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return undefined;

  const result = (await response.json()) as { photoUri?: string };
  const attribution = photo.authorAttributions?.[0];
  return result.photoUri
    ? {
        url: result.photoUri,
        author: attribution?.displayName,
        authorUrl: attribution?.uri,
      }
    : undefined;
}

async function enrichWithPlacesApi(
  scraped: Restaurant,
  apiKey: string,
): Promise<Restaurant> {
  let placeId = scraped.placeId;

  if (!placeId) {
    const searchResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          textQuery: `${scraped.name}, ${scraped.address}`,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (searchResponse.ok) {
      const search = (await searchResponse.json()) as {
        places?: { id?: string }[];
      };
      placeId = search.places?.[0]?.id;
    }
  }

  if (!placeId) return scraped;

  const fields = [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "primaryTypeDisplayName",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "rating",
    "userRatingCount",
    "websiteUri",
    "googleMapsUri",
    "editorialSummary",
    "currentOpeningHours",
    "regularOpeningHours",
    "photos",
    "reviews",
  ].join(",");
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      cache: "no-store",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fields,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) return scraped;

  const place = (await response.json()) as GooglePlace;
  const resolvedPhotos = await Promise.all(
    (place.photos ?? [])
      .slice(0, 10)
      .map((photo) => resolvePlacePhoto(photo, apiKey)),
  );
  const photos = resolvedPhotos.filter(
    (photo): photo is RestaurantPhoto => photo !== undefined,
  );
  const reviews = (place.reviews ?? []).flatMap((review) => {
    const text = review.text?.text?.trim();
    if (!text) return [];

    return [
      {
        author: review.authorAttribution?.displayName ?? "Google Maps user",
        authorUrl: review.authorAttribution?.uri,
        avatarUrl: review.authorAttribution?.photoUri,
        rating: review.rating ?? 5,
        text,
        relativeTime: review.relativePublishTimeDescription,
        googleMapsUrl: review.googleMapsUri,
      },
    ];
  });

  return {
    ...scraped,
    name: place.displayName?.text ?? scraped.name,
    category: place.primaryTypeDisplayName?.text ?? scraped.category,
    address: place.formattedAddress ?? scraped.address,
    phone:
      place.internationalPhoneNumber ??
      place.nationalPhoneNumber ??
      scraped.phone,
    website: place.websiteUri ?? scraped.website,
    latitude: place.location?.latitude ?? scraped.latitude,
    longitude: place.location?.longitude ?? scraped.longitude,
    placeId: place.id ?? placeId,
    rating: place.rating ?? scraped.rating,
    reviewCount: place.userRatingCount ?? scraped.reviewCount,
    openingStatus:
      place.currentOpeningHours?.openNow === true
        ? "Abierto ahora"
        : place.currentOpeningHours?.openNow === false
          ? "Cerrado ahora"
          : scraped.openingStatus,
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions ??
      place.currentOpeningHours?.weekdayDescriptions ??
      scraped.openingHours,
    description: place.editorialSummary?.text ?? scraped.description,
    photos: photos.length > 0 ? photos : scraped.photos,
    reviews: reviews.length > 0 ? reviews : scraped.reviews,
    googleMapsUrl: place.googleMapsUri ?? scraped.googleMapsUrl,
    importedWith: "places-api",
  };
}

export const importRestaurant = cache(async (mapsUrl: string) => {
  const scraped = await scrapeGoogleMaps(mapsUrl);
  const apifyToken = process.env.APIFY_PERSONAL_API_TOKEN;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apifyToken) {
    try {
      return await enrichWithApify(scraped, apifyToken, mapsUrl);
    } catch {
      // The official Places API and preview payload remain degraded fallbacks.
    }
  }

  if (!apiKey) return scraped;

  try {
    return await enrichWithPlacesApi(scraped, apiKey);
  } catch {
    return scraped;
  }
});

export function restaurantSlug(name: string) {
  const reservedSlugs = new Set(["api", "generating"]);
  const genericWords = new Set([
    "bar",
    "cafe",
    "cebicheria",
    "cevicheria",
    "el",
    "la",
    "las",
    "los",
    "restaurant",
    "restaurante",
  ]);
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const distinctive = normalized
    .split(/\s+/)
    .filter((part) => part && !genericWords.has(part))
    .join("-");

  const slug = distinctive || normalized.replace(/\s+/g, "-") || "restaurant";
  return reservedSlugs.has(slug) ? `${slug}-local` : slug;
}
