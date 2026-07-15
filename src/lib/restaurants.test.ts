import { describe, expect, test } from "bun:test";
import {
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
    ).toThrow("That does not look like a Google Maps place link.");
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
