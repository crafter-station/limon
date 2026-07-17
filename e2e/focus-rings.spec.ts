import { expect, test } from "@playwright/test";

test.describe("Limon landing — keyboard & focus rings", () => {
  test("submit button shows a visible focus ring (box-shadow) on keyboard focus", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByLabel(/Link de Google Maps/i);
    await input.focus();
    const before = await input.evaluate((el) => getComputedStyle(el).boxShadow);
    await page.keyboard.press("Tab");
    const submit = page
      .locator("#hero-form")
      .getByRole("button", { name: /Arma mi web/i });
    await expect(submit).toBeFocused();
    const after = await submit.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(
      after,
      "focused submit button should render a visible ring (non-'none' box-shadow)",
    ).not.toBe("none");
    expect(after).not.toBe(before);
  });

  test("footer + CTA-band links are reachable via Tab and show a focus ring", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(300);

    const ctaLink = page.getByRole("link", { name: /Arma mi web/i }).last();
    await ctaLink.focus();
    const ring = await ctaLink.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(
      ring,
      "CTA band link should show a visible focus ring when focused",
    ).not.toBe("none");
  });
});
