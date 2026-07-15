import "server-only";

import { generateText, Output } from "ai";
import { type GeneratedMenu, generatedMenuSchema } from "@/lib/menus";

export const MENU_VISION_MODEL =
  process.env.MENU_VISION_MODEL || "google/gemini-2.5-flash-lite";

export async function extractMenuFromImages(
  restaurantName: string,
  imageUrls: string[],
): Promise<GeneratedMenu | undefined> {
  if (imageUrls.length === 0) return undefined;

  const { output } = await generateText({
    model: MENU_VISION_MODEL,
    output: Output.object({
      name: "RestaurantMenu",
      description:
        "Menu sections and items visibly present in restaurant photos.",
      schema: generatedMenuSchema,
    }),
    instructions:
      "Extract a restaurant menu from the supplied Google Maps photos. " +
      "Ignore storefront, food-only, people, interior, and unreadable photos. " +
      "Return only text that is visibly present. Keep the original language. " +
      "Use null when a description, amount, currency, or label is not visible. " +
      "Amounts are decimal strings without currency symbols. Currency is an ISO-4217 code when visible or null. " +
      "Do not invent menu items, ingredients, prices, or currencies.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Find and transcribe any menu shown in these photos for ${restaurantName}.`,
          },
          ...imageUrls.slice(0, 10).map((url) => ({
            type: "image" as const,
            image: new URL(url),
          })),
        ],
      },
    ],
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(60_000),
  });

  return output.sections.some((section) => section.items.length > 0)
    ? output
    : undefined;
}
