import { expect, test } from "@playwright/test";

test("mobile navigation drawer opens, navigates and has no horizontal page scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Understanding Fire Beyond Earth" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: "Prediction & Modeling" }).click();
  await expect(page.getByRole("heading", { name: "Prediction & Modeling", level: 1 })).toBeVisible();
  await expect(drawer).toBeHidden();
  for (const path of ["/experiments", "/phenomena/flame-extinction", "/phenomena/flame-spread", "/phenomena/spacecraft-fire",
    "/reliability", "/copilot", "/intelligence/compare", "/evidence/literature", "/modeling"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(ov, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
