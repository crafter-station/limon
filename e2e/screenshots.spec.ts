import { test } from "@playwright/test";

// Evidence-only: captures full-page screenshots used in the QA report.
test.describe("QA evidence screenshots", () => {
  test("hero", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `qa-artifacts/hero-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });

  test("error state", async ({ page }, testInfo) => {
    await page.goto(
      "/?error=" +
        encodeURIComponent(
          "Revisa que el link sea de un lugar en Google Maps.",
        ) +
        "&maps=" +
        encodeURIComponent("http://example.com"),
    );
    await page.waitForTimeout(800);
    await page.screenshot({
      path: `qa-artifacts/error-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });
});
