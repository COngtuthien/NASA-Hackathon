import { expect, test } from "@playwright/test";

// Phase 12 on a phone (Pixel 7 profile, 390 px) and a 768 px tablet: the theme switcher is in the header, touch-sized
// and usable; both themes render every key page without horizontal overflow.

test("phone and tablet: theme switcher in the header, both themes, no overflow", async ({ page }) => {
  test.setTimeout(240_000);
  for (const size of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.goto("/");
    const sw = page.getByRole("radiogroup", { name: "Colour theme" });
    await expect(sw).toBeInViewport();
    for (const t of ["light", "dark"] as const) {
      const r = sw.getByRole("radio", { name: t === "light" ? "Light theme" : "Dark theme" });
      const b = (await r.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(32);
      await r.tap();
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(t);
      for (const path of ["/", "/phenomena/flame-extinction", "/experiments", "/reliability", "/evidence/media"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.dataset.theme), path).toBe(t);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${t} ${size.width}px ${path}`).toBeLessThanOrEqual(1);
        // the header keeps the menu, the logo on one line and the switcher
        const logo = (await page.getByRole("link", { name: "SpaceFire AI home" }).first().boundingBox())!;
        expect(logo.height).toBeLessThan(40);
      }
      await page.goto("/");
    }
  }
});
