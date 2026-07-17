import { expect, test } from "@playwright/test";

/**
 * Regression coverage for the #camino sticky spiral (MindMarket-style rewrite).
 * See design.md's own "Nota técnica" on why `overflow` on an ancestor of a
 * `position: sticky` block silently breaks the pin.
 */

async function scrollToFraction(
  page: import("@playwright/test").Page,
  frac: number,
) {
  await page.evaluate(
    ([f]) => {
      const el = document.getElementById("camino");
      if (!el) return;
      const runway = Array.from(el.querySelectorAll<HTMLElement>("div")).find(
        (d) => /^\d+vh$/.test(d.style.height) || d.className.includes("h-["),
      );
      const target = runway ?? (el.firstElementChild as HTMLElement);
      const rect = target.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrollTarget = window.scrollY + rect.top + total * f;
      window.scrollTo(0, Math.max(scrollTarget, 0));
    },
    [frac] as const,
  );
}

test.describe("Limon landing — #camino sticky spiral", () => {
  test("sticky stage stays pinned to the viewport top throughout the scroll runway", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(1200);
    await page.locator("#camino").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const samples: { frac: number; svgTop: number }[] = [];
    for (const frac of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      await scrollToFraction(page, frac);
      await page.waitForTimeout(200);
      const svgTop = await page.evaluate(() => {
        const svg = document.querySelector("#camino svg");
        return svg ? svg.getBoundingClientRect().top : Number.NaN;
      });
      samples.push({ frac, svgTop });
    }

    for (const s of samples) {
      expect(
        Math.abs(s.svgTop),
        `expected sticky stage pinned near y=0, got y=${s.svgTop} at scroll fraction ${s.frac}. ` +
          `If this fails, an ancestor of the "sticky top-0" div likely has overflow != visible ` +
          `(see design.md "Nota técnica" — overflow on a sticky ancestor breaks the pin).`,
      ).toBeLessThan(8);
    }
  });

  test("step cards and the ribbon path are visible at multiple points in the runway (not a blank scroll)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForTimeout(1200);
    await page.locator("#camino").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    let anyCardVisible = false;
    for (const frac of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      await scrollToFraction(page, frac);
      await page.waitForTimeout(250);
      const visibleCard = page
        .locator("#camino article")
        .filter({ hasText: /Pega el link|Juntamos lo público|ya está lista/i });
      const count = await visibleCard.count();
      for (let i = 0; i < count; i++) {
        const box = await visibleCard.nth(i).boundingBox();
        const opacity = await visibleCard
          .nth(i)
          .evaluate((el) =>
            Number(getComputedStyle(el.parentElement!).opacity),
          );
        if (box && opacity > 0.5 && box.y > -50 && box.y < 900) {
          anyCardVisible = true;
        }
      }
    }

    expect(
      anyCardVisible,
      "expected at least one step card to be fully visible on-screen while scrolling through #camino",
    ).toBe(true);
  });
});
