import { type ConsoleMessage, expect, test } from "@playwright/test";

function isEnvWebglNoise(text: string) {
  return /THREE\.WebGLProgram|VALIDATE_STATUS|Shader Error|Program Info Log/i.test(
    text,
  );
}

test.describe("Limon landing — full-page scroll", () => {
  test("no console/page errors while scrolling the entire page (hero -> camino -> CTA -> footer)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && !isEnvWebglNoise(msg.text())) {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (!isEnvWebglNoise(err.message))
        errors.push(`pageerror: ${err.message}`);
    });

    await page.goto("/");
    await page.waitForTimeout(1500);

    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await page.evaluate(([y]) => window.scrollTo(0, y as number), [
        Math.round((height / steps) * i),
      ] as const);
      await page.waitForTimeout(150);
    }

    expect(
      errors,
      `console/page errors during scroll: ${errors.join("\n")}`,
    ).toEqual([]);
  });

  test("no broken internal anchor links on the landing page", async ({
    page,
  }) => {
    await page.goto("/");
    const hrefs = await page
      .locator("a[href^='#']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(
      hrefs.length,
      "expected at least one in-page anchor link",
    ).toBeGreaterThan(0);
    for (const href of hrefs) {
      const id = href!.slice(1);
      const target = page.locator(`#${id}`);
      await expect(
        target,
        `anchor link "${href}" has no matching element with id="${id}"`,
      ).toHaveCount(1);
    }
  });
});
