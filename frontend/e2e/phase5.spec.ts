import { expect, test } from "@playwright/test";
import { MEDIA } from "../lib/scientific-media";

// Phase 5: verified NASA media, provenance labels, gallery, lightbox accessibility, no autoplay / third-party loads.

test.describe("Phase 5: scientific media", () => {
  test("every registry asset is served and every item has complete attribution", async ({ request }) => {
    for (const m of MEDIA) {
      expect(m.sourceUrl, m.id).toMatch(/^https:\/\//);
      expect(m.credit.length, m.id).toBeGreaterThan(0);
      expect(m.alt.length, m.id).toBeGreaterThan(20);
      expect(m.relationNote.length, m.id).toBeGreaterThan(20);
      expect(m.testId, `${m.id} must not claim a test ID`).toBeUndefined();
      const files = [...m.variants.map((v) => v.src), m.poster?.src, m.animation, m.video?.src].filter(Boolean) as string[];
      for (const f of files) {
        const r = await request.get(f);
        expect(r.status(), f).toBe(200);
      }
    }
  });

  test("Mission Control hero is a labelled real NASA photo; story steps carry sourced media", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator('section[aria-labelledby="hero-title"] figure');
    await expect(hero.getByText("Experiment media")).toBeVisible();
    await expect(hero.getByRole("link", { name: /iss040e088023/ })).toHaveAttribute("href", "https://images.nasa.gov/details/iss040e088023");
    const story = page.locator("#physics");
    await story.scrollIntoViewIfNeeded();
    await expect(story.locator('figure:has(img[src^="/media/"])')).toHaveCount(4);
    await expect(story.locator("blockquote a")).toHaveCount(4);  // the document citations are kept
    // every image on the page decodes and reserves its size
    for (let y = 0; y < 12000; y += 900) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
    const imgs = await page.evaluate(() => [...document.querySelectorAll('img[src^="/media/"]')].map((i) => ({
      ok: (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0, sized: !!i.getAttribute("width") && !!i.getAttribute("height") })));
    expect(imgs.length).toBeGreaterThan(10);
    expect(imgs.every((i) => i.ok && i.sized)).toBe(true);
    // each figure on the page names its source with a working external link
    const missing = await page.evaluate(() => [...document.querySelectorAll("figure")].filter((f) => f.querySelector('img[src^="/media/"]'))
      .filter((f) => !f.querySelector('figcaption a[href^="https://"]')).length);
    expect(missing).toBe(0);
  });

  test("lightbox is keyboard accessible and restores focus", async ({ page }) => {
    await page.goto("/phenomena/flame-spread");
    const trigger = page.getByRole("button", { name: /Open “Running BASS-II in the Microgravity Science Glovebox”/ });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Running BASS-II in the Microgravity Science Glovebox" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(dialog.getByText("iss038e047576", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Why it is labelled/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("gallery filters by phenomenon, type and relation, and opens details", async ({ page }) => {
    await page.goto("/evidence/media");
    await expect(page.getByRole("heading", { name: "Scientific media" })).toBeVisible();
    await expect(page.getByText(`${MEDIA.length} of ${MEDIA.length} items`)).toBeVisible();
    const group = page.getByRole("group", { name: "Filter the media" });
    await group.getByRole("button", { name: /^Spacecraft fire/ }).click();
    await expect(page).toHaveURL(/phenomenon=PSI-98/);
    const n98 = MEDIA.filter((m) => m.datasetInv === "PSI-98").length;
    await expect(page.getByText(`${n98} of ${MEDIA.length} items`)).toBeVisible();
    await group.getByRole("button", { name: /^Related NASA media/ }).click();
    await expect(page.getByText(/^0 of \d+ items$/)).toBeVisible();  // SAFFIRE-I media are all real experiment media
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await group.getByRole("button", { name: /^Video/ }).click();
    await page.getByRole("button", { name: /Saffire-I Experiment Burns in Space \(video\): open/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "NASA Video on YouTube" })).toHaveAttribute("href", /youtube\.com\/watch\?v=j23887AMwXk/);
  });

  test("no third-party video or animation loads before the user asks", async ({ page }) => {
    const ytRequests: string[] = [];
    page.on("request", (r) => { if (/youtube|ytimg|googlevideo/.test(r.url())) ytRequests.push(r.url()); });
    await page.goto("/phenomena/spacecraft-fire#footage");
    const footage = page.locator("#footage");
    await expect(footage.getByRole("button", { name: /Play “Saffire-I Experiment Burns in Space”/ })).toBeVisible();
    await expect(footage.locator("iframe")).toHaveCount(0);
    expect(ytRequests).toEqual([]);
    const img = footage.locator('img[alt^="Low-resolution camera view"]');
    await expect(img).toHaveAttribute("src", /poster\.webp/);
    await footage.getByRole("button", { name: "Play NASA animation" }).click();
    await expect(img).toHaveAttribute("src", /animation\.webp/);
    await footage.getByRole("button", { name: /Play “Saffire-I Experiment Burns in Space”/ }).click();
    await expect(footage.locator('iframe[src^="https://www.youtube-nocookie.com/embed/j23887AMwXk"]')).toHaveCount(1);
    await expect(page.getByText(/no manifest frame is shown or reconstructed/)).toBeVisible();
  });

  test("experiment detail shows investigation imagery that disclaims the selected test", async ({ page }) => {
    await page.goto("/experiments/bass2/bass2%3A33");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: "Investigation imagery" }) });
    await expect(panel.getByText(/It does not show test M7/)).toBeVisible();
    await expect(panel.getByText("Experiment media")).toBeVisible();
  });

  test("reduced motion: media are visible without reveal animation", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/evidence/media");
    const card = page.getByRole("button", { name: /BASS-II flame over an acrylic slab: open/ });
    await expect(card).toBeVisible();
    const img = card.locator("img");
    await expect.poll(async () => img.evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await ctx.close();
  });
});
