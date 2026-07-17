import { expect, test } from "@playwright/test";

test.describe("Limon landing — hero visual contract", () => {
  test("primary submit CTA renders in the Maps-red brand color, not ink/black", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    const submit = page
      .locator("#hero-form")
      .getByRole("button", { name: /Arma mi web/i });
    await expect(submit).toBeVisible();
    const bg = await submit.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    // --mm-maps-red: #ea4335 -> rgb(234, 67, 53). Ink (#2c2e2a) -> rgb(44, 46, 42).
    // Assert it is NOT the dark ink color, and IS a red-dominant color.
    expect(bg, `submit button background should be red, got ${bg}`).not.toBe(
      "rgb(44, 46, 42)",
    );
    const [r, g, b] = bg.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
    expect(
      r > g + 40 && r > b + 40,
      `submit button background ${bg} should be red-dominant (r significantly > g and b)`,
    ).toBe(true);
  });
});
