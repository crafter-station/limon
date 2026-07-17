import { expect, test } from "@playwright/test";

test.describe("Limon landing — reduced motion", () => {
  test("#camino content is reachable/visible for reduced-motion users without excessive blank scrolling", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(1200);

    await page.locator("#camino").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const heading = page.locator("#how-heading");
    const headingBox = await heading.boundingBox();
    const inViewportAtStart =
      !!headingBox && headingBox.y > -50 && headingBox.y < 900;

    // Scroll halfway through the runway height and re-check.
    const runwayHeight = await page.evaluate(() => {
      const el = document.getElementById("camino");
      return el ? el.getBoundingClientRect().height : 0;
    });
    await page.evaluate(([h]) => window.scrollBy(0, (h as number) * 0.4), [
      runwayHeight,
    ] as const);
    await page.waitForTimeout(400);

    const anyCard = page.locator("#camino article").first();
    const cardVisible = await anyCard
      .boundingBox()
      .then((box) => !!box && box.y > -50 && box.y < 900)
      .catch(() => false);

    expect(
      inViewportAtStart || cardVisible,
      "with reduced motion, #camino heading/cards should still be reachable without scrolling through several blank screens",
    ).toBe(true);
    await context.close();
  });
});
