import { describe, expect, spyOn, test } from "bun:test";
import {
  importRestaurant,
  mapApifyRestaurant,
  type Restaurant,
  restaurantSlug,
  validateGoogleMapsUrl,
} from "./restaurants";

const fallback: Restaurant = {
  name: "Fallback",
  category: "Restaurante",
  address: "Fallback address",
  openingHours: [],
  description: "Fallback description",
  photos: [],
  reviews: [],
  googleMapsUrl: "https://www.google.com/maps/place/fallback",
  importedWith: "google-maps-preview",
};

describe("mapApifyRestaurant", () => {
  test("normalizes rich place data into the stored restaurant model", () => {
    const restaurant = mapApifyRestaurant(
      {
        title: "Las Palmeras",
        categoryName: "Restaurante",
        address: "Rioja, Peru",
        location: { lat: -6.05, lng: -77.17 },
        placeId: "place-1",
        totalScore: 4,
        reviewsCount: 60,
        openingHours: [{ day: "lunes", hours: "9:00-18:00" }],
        images: [
          {
            imageUrl: "https://lh5.googleusercontent.com/photo",
            authorName: "Owner",
          },
        ],
        reviews: [
          {
            reviewId: "review-1",
            name: "Maria",
            stars: 5,
            text: "Excelente ceviche",
          },
        ],
      },
      fallback,
    );

    expect(restaurant.name).toBe("Las Palmeras");
    expect(restaurant.placeId).toBe("place-1");
    expect(restaurant.openingHours).toEqual(["lunes: 9:00-18:00"]);
    expect(restaurant.photos[0]?.author).toBe("Owner");
    expect(restaurant.reviews[0]?.author).toBe("Maria");
    expect(restaurant.importedWith).toBe("apify");
  });

  test("keeps generated fallback copy when Apify has no description", () => {
    const restaurant = mapApifyRestaurant(
      { title: "Las Palmeras", categoryName: "Restaurante" },
      fallback,
    );

    expect(restaurant.description).toContain("Las Palmeras");
    expect(restaurant.photos).toEqual([]);
  });
});

describe("importRestaurant", () => {
  test("sends the public Maps place URL to Apify instead of the preview URL", async () => {
    const mapsUrl = "https://www.google.com/maps/place/Las+Palmeras";
    const previewUrl =
      "https://www.google.com/maps/preview/place/Las+Palmeras?pb=test";
    const place = new Array(228);
    place[4] = new Array(9);
    place[4][7] = 4;
    place[4][8] = 60;
    place[9] = [null, null, -6.05, -77.17];
    place[11] = "Las Palmeras";
    place[13] = ["Restaurante"];
    place[18] = "Rioja, Peru";
    place[42] = previewUrl;
    const previewPayload = new Array(7);
    previewPayload[6] = place;
    const originalToken = process.env.APIFY_PERSONAL_API_TOKEN;
    const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
    process.env.APIFY_PERSONAL_API_TOKEN = "test-token";
    delete process.env.GOOGLE_MAPS_API_KEY;

    const fetchMock = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );

      if (url.hostname === "api.apify.com") {
        const body = JSON.parse(String(init?.body)) as {
          startUrls: { url: string }[];
        };
        if (body.startUrls[0]?.url.includes("/maps/preview/")) {
          return new Response("Invalid Google Maps URL", { status: 400 });
        }
        return Response.json([
          {
            title: "Las Palmeras",
            reviewsCount: 60,
            reviews: [
              {
                name: "Maria",
                stars: 5,
                text: "Excelente ceviche",
              },
            ],
          },
        ]);
      }

      if (url.pathname.startsWith("/maps/preview/place")) {
        return new Response(`)]}'\n${JSON.stringify(previewPayload)}`);
      }

      return new Response('<a href="/maps/preview/place?pb=test">details</a>');
    };
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      fetchMock as typeof fetch,
    );

    try {
      const restaurant = await importRestaurant(mapsUrl);

      expect(restaurant.importedWith).toBe("apify");
      expect(restaurant.reviews).toHaveLength(1);
      expect(restaurant.reviews[0]?.text).toBe("Excelente ceviche");
    } finally {
      fetchSpy.mockRestore();
      if (originalToken === undefined) {
        delete process.env.APIFY_PERSONAL_API_TOKEN;
      } else {
        process.env.APIFY_PERSONAL_API_TOKEN = originalToken;
      }
      if (originalApiKey === undefined) {
        delete process.env.GOOGLE_MAPS_API_KEY;
      } else {
        process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
      }
    }
  });
});

describe("Google Maps URL validation", () => {
  test("accepts Google Maps and owned short-link hosts", () => {
    expect(
      validateGoogleMapsUrl("https://www.google.com/maps/place/Las+Palmeras"),
    ).toBe("https://www.google.com/maps/place/Las+Palmeras");
    expect(validateGoogleMapsUrl("https://maps.app.goo.gl/example")).toBe(
      "https://maps.app.goo.gl/example",
    );
  });

  test("rejects lookalike Google subdomains", () => {
    expect(() =>
      validateGoogleMapsUrl("https://maps.google.evil.com/maps/place/test"),
    ).toThrow("Revisa que el link sea de un lugar en Google Maps.");
  });

  test("removes tracking parameters while preserving cid lookups", () => {
    expect(
      validateGoogleMapsUrl(
        "https://www.google.com/maps/place/Las+Palmeras?entry=ttu#section",
      ),
    ).toBe("https://www.google.com/maps/place/Las+Palmeras");
    expect(
      validateGoogleMapsUrl(
        "https://www.google.com/maps?cid=123&entry=ttu#section",
      ),
    ).toBe("https://www.google.com/maps?cid=123");
    expect(
      validateGoogleMapsUrl(
        "https://www.google.com/maps/search/?api=1&query=Las+Palmeras&query_place_id=place-1&utm_source=test",
      ),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Las+Palmeras&query_place_id=place-1",
    );
  });
});

describe("restaurantSlug", () => {
  test("does not collide with application route segments", () => {
    expect(restaurantSlug("API Restaurant")).toBe("api-local");
    expect(restaurantSlug("Generating Restaurant")).toBe("generating-local");
  });
});
