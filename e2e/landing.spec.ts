import { type ConsoleMessage, expect, test } from "@playwright/test";

const SAMPLE_MAPS_URL =
  "https://www.google.com/maps/place/Cevicheria+%22Las+Palmeras%22/@-6.0546499,-77.2167419,13z/data=!4m6!3m5!1s0x91b7279870584b0f:0x44e376e36c0739b3!8m2!3d-6.050179!4d-77.1720976!16s%2Fg%2F11b5qh5cn0";

// Headless Chromium runs WebGL on SwiftShader (no GPU), so the shadow pipeline
// spams THREE.WebGLProgram shader-compile errors that do NOT occur on real
// hardware. Filter that environment noise so the assertion targets APP errors.
// (The lack of a WebGL fallback is tracked as its own finding.)
function isEnvWebglNoise(text: string) {
  return /THREE\.WebGLProgram|VALIDATE_STATUS|Shader Error|Program Info Log/i.test(
    text,
  );
}

function collectConsole(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error" && !isEnvWebglNoise(msg.text())) {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    if (!isEnvWebglNoise(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

test.describe("Limon landing — happy path", () => {
  test("hero renders form + primary CTA above the fold, no console errors", async ({
    page,
  }) => {
    const errors = collectConsole(page);
    await page.goto("/");

    const input = page.getByLabel(/Link de Google Maps/i);
    await expect(input).toBeVisible();
    const submit = page
      .locator("#hero-form")
      .getByRole("button", { name: /Arma mi web/i });
    await expect(submit).toBeVisible();

    // Form and CTA should be within the first viewport (not buried below scroll).
    const box = await submit.boundingBox();
    const vh = page.viewportSize()?.height ?? 0;
    expect(box, "submit button has a bounding box").toBeTruthy();
    expect(box!.y).toBeLessThan(vh);

    // Give the 3D scene a beat to mount, then check for console noise.
    await page.waitForTimeout(1500);
    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
  });

  test("form input is not blocked by the 3D canvas (pointer-events)", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByLabel(/Link de Google Maps/i);
    // A real user click at the input's center must reach the input, even though
    // a fixed WebGL canvas overlays the page.
    await input.click();
    await expect(input).toBeFocused();
    await input.fill("https://maps.app.goo.gl/test");
    await expect(input).toHaveValue("https://maps.app.goo.gl/test");
  });

  test("example link prefills the form via ?maps=", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Prueba con/i }).click();
    await page.waitForURL(/\?maps=/);
    const input = page.getByLabel(/Link de Google Maps/i);
    await expect(input).toHaveValue(SAMPLE_MAPS_URL);
  });

  test("secondary CTA scrolls back to hero and focuses the input", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Pega tu link/i }).click();
    const input = page.getByLabel(/Link de Google Maps/i);
    await expect(input).toBeFocused({ timeout: 3000 });
  });
});

test.describe("Limon landing — error / edge states", () => {
  test("server error string surfaces in the form (language check)", async ({
    page,
  }) => {
    // Simulates the server action redirect on failure.
    await page.goto(
      "/?error=" +
        encodeURIComponent(
          "Revisa que el link sea de un lugar en Google Maps.",
        ) +
        "&maps=" +
        encodeURIComponent("http://example.com"),
    );
    const alert = page.locator('p[role="alert"]');
    await expect(alert).toBeVisible();
    const text = (await alert.textContent()) ?? "";
    expect(text).toContain("link sea de un lugar en Google Maps");
  });

  test("browser URL validation blocks empty + non-URL submit", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByLabel(/Link de Google Maps/i);
    const submit = page
      .locator("#hero-form")
      .getByRole("button", { name: /Arma mi web/i });

    // Empty submit -> native required validity should block.
    await submit.click();
    const validAfterEmpty = await input.evaluate((el: HTMLInputElement) =>
      el.checkValidity(),
    );
    expect(validAfterEmpty).toBe(false);

    // Non-URL text -> type=url invalidity.
    await input.fill("no soy una url");
    const validAfterText = await input.evaluate((el: HTMLInputElement) =>
      el.checkValidity(),
    );
    expect(validAfterText).toBe(false);
  });
});

test.describe("Limon landing — accessibility & motion", () => {
  test("reduced motion: no console errors, form still usable", async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = collectConsole(page);
    await page.goto("/");
    const input = page.getByLabel(/Link de Google Maps/i);
    await input.click();
    await expect(input).toBeFocused();
    await page.waitForTimeout(1200);
    expect(errors, `console errors: ${errors.join("\n")}`).toEqual([]);
    await context.close();
  });

  test("keyboard: input is reachable via Tab from the top", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByLabel(/Link de Google Maps/i);
    let reached = false;
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      if (await input.evaluate((el) => el === document.activeElement)) {
        reached = true;
        break;
      }
    }
    expect(reached, "input reachable via Tab within 8 stops").toBe(true);
  });
});
