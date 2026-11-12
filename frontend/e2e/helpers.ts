import type { Page } from "@playwright/test";

/**
 * Phase 8: research-level content sits in named disclosures (components/disclosure.tsx). Open one the way a user
 * does, by its button, when it is still closed. `id` is the section's anchor (e.g. "map", "d2", "values").
 */
export async function openSection(page: Page, id: string) {
  const section = page.locator(`section#${id}`);
  await section.scrollIntoViewIfNeeded();
  const btn = section.locator(':scope > div > button[aria-expanded]').first();
  if ((await btn.getAttribute("aria-expanded")) === "false") await btn.click();
}
