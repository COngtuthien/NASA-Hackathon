import { expect, test } from "@playwright/test";

test("mobile navigation drawer opens, navigates and has no horizontal page scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "How fire behaves when nothing falls" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "FLEX burn-time model" }).click();
  await expect(page.getByRole("heading", { name: "FLEX burn-time model" })).toBeVisible();
  await expect(drawer).toBeHidden();
  for (const path of ["/experiments", "/physics/saffire-i", "/quality"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ov, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
