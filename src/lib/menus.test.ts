import { describe, expect, test } from "bun:test";
import { generatedMenuSchema } from "./menus";

describe("generated menu schema", () => {
  test("accepts visible menu fields with nullable missing values", () => {
    const result = generatedMenuSchema.parse({
      sections: [
        {
          name: "Entradas",
          items: [
            {
              name: "Ceviche clasico",
              description: null,
              prices: [{ label: null, amount: "29.90", currency: "PEN" }],
              variants: [],
            },
          ],
        },
      ],
    });
    expect(result.sections[0].items[0].prices[0].amount).toBe("29.90");
  });

  test("rejects unstructured model output", () => {
    expect(() =>
      generatedMenuSchema.parse({
        sections: [{ name: "Entradas", items: [{ name: "Ceviche" }] }],
      }),
    ).toThrow();
  });
});
