// UX density audit (Phase 8). For each page: visible words in <main>, visible numeric tokens, visible badge-like
// pills, words in the first viewport, and page height. Only content a sighted user sees by default is counted
// (closed <details>, hidden tab panels and collapsed regions are excluded).
// Usage: node scripts/ux-audit.mjs [label] [width]   (needs the app on http://localhost:3000)
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const PAGES = ["/", "/phenomena/flame-extinction", "/phenomena/flame-spread", "/phenomena/spacecraft-fire", "/experiments",
  "/experiments/flex/flex%3A180", "/copilot", "/evidence", "/evidence/literature", "/evidence/media", "/reliability",
  "/methodology", "/modeling", "/intelligence/similar", "/intelligence/compare"];
const label = process.argv[2] ?? "audit";
const width = Number(process.argv[3] ?? 1440);

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width, height: 900 } });
const out = [];
for (const path of PAGES) {
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return null;
    const visible = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === "none" || s.visibility === "hidden" || e.hidden) return false;
        if (e.tagName === "DETAILS" && !e.open && e !== el) return false;
      }
      return true;
    };
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let words = 0, numbers = 0, fold = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || ["SCRIPT", "STYLE"].includes(p.tagName)) continue;
      // text inside a closed <details> is hidden except its <summary>
      const det = p.closest("details");
      if (det && !det.open && !p.closest("summary")) continue;
      if (!visible(p)) continue;
      const t = n.textContent.trim();
      if (!t) continue;
      const w = t.split(/\s+/).length;
      words += w;
      numbers += (t.match(/\d+(?:[.,]\d+)?/g) ?? []).length;
      const r = p.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) fold += w;
    }
    const pills = [...main.querySelectorAll("span,a")].filter((e) => {
      const c = e.className?.toString() ?? "";
      return /rounded(-full)?\b/.test(c) && /border/.test(c) && e.textContent.trim().length < 40 && visible(e) && !e.closest("details:not([open])");
    }).length;
    return { words, numbers, fold, pills, height: document.documentElement.scrollHeight };
  });
  out.push({ path, ...m });
  console.log(path.padEnd(34), JSON.stringify(m));
}
writeFileSync(`../docs/ux-audit-${label}-${width}.json`, JSON.stringify(out, null, 1));
await browser.close();
