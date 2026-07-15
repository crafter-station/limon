import { afterAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const integrationTest = process.env.DATABASE_URL ? describe : describe.skip;
let restaurantId: string | undefined;

integrationTest("Drizzle persistence", () => {
  afterAll(async () => {
    if (!restaurantId) return;
    const [{ eq }, { restaurants }, { database }] = await Promise.all([
      import("drizzle-orm"),
      import("@/db/schema"),
      import("./db"),
    ]);
    await database()
      .delete(restaurants)
      .where(eq(restaurants.id, restaurantId));
  });

  test("stores and reads a generated menu", async () => {
    const { createRestaurantRecord, getPublishedMenu, saveGeneratedMenu } =
      await import("./database");
    const restaurant = await createRestaurantRecord(
      `https://example.test/${crypto.randomUUID()}`,
    );
    restaurantId = restaurant.id;
    await saveGeneratedMenu(
      restaurant.id,
      ["https://example.test/menu.jpg"],
      "google/gemini-2.5-flash-lite",
      {
        sections: [
          {
            name: "Entradas",
            items: [
              {
                name: "Ceviche",
                description: null,
                prices: [{ label: null, amount: "29.90", currency: "PEN" }],
                variants: [],
              },
            ],
          },
        ],
      },
    );
    const menu = await getPublishedMenu(restaurant.id);
    expect(menu?.sections[0].items[0].name).toBe("Ceviche");
  });
});
