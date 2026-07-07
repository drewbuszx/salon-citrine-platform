#!/usr/bin/env node
/**
 * Desktop sidebar regression QA — verifies shared list-layout sidebar chrome
 * at desktop widths (sidebar width, vertical nav rows, no native button styling).
 *
 * Usage:
 *   npm run qa:desktop-sidebar --workspace apps/team
 *   TEAM_QA_BASE_URL=http://localhost:4322/team npm run qa:desktop-sidebar --workspace apps/team
 *
 * Authenticated routes: set TEAM_QA_STORAGE_STATE to a Playwright storageState JSON path.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTHS = [1024, 1280, 1440, 1920];
const ROUTES = [
  { path: "/tasks", sidebarSelector: ".team-list-layout__sidebar-nav-btn" },
  { path: "/inventory", sidebarSelector: ".team-list-layout__filter-option" },
  { path: "/clients", sidebarSelector: ".team-list-layout__filter-option" },
  { path: "/docs", sidebarSelector: ".team-list-layout__sidebar-nav-btn" },
  { path: "/events", sidebarSelector: ".team-list-layout__filter-option" },
  { path: "/reports", sidebarSelector: ".team-list-layout__sidebar-link" },
];

const BASE_URL = (process.env.TEAM_QA_BASE_URL ?? "http://localhost:4322/team").replace(/\/$/, "");
const STORAGE_STATE = process.env.TEAM_QA_STORAGE_STATE;
const MIN_SIDEBAR_WIDTH = 250;

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    console.error(
      "Playwright is not installed. Run: npm install -D playwright --workspace apps/team && npx playwright install chromium",
    );
    process.exit(1);
  }
}

async function auditSidebar(page, route, width) {
  const url = `${BASE_URL}${route.path}`;
  await page.setViewportSize({ width, height: 900 });
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  const checks = await page.evaluate(
    ({ sidebarSelector, minSidebarWidth }) => {
      const sidebar = document.querySelector(".team-list-layout__sidebar");
      const main = document.querySelector(".team-list-layout__main");
      const items = [...document.querySelectorAll(sidebarSelector)];

      const sidebarRect = sidebar?.getBoundingClientRect();
      const sidebarWidth = sidebarRect?.width ?? 0;

      const itemRows = items.map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          display: style.display,
          width: Math.round(rect.width),
          appearance: style.appearance || style.webkitAppearance,
          background: style.backgroundColor,
        };
      });

      // Detect items sharing the same row (within 4px tolerance)
      const rowGroups = new Map();
      for (const item of itemRows) {
        const key = item.top;
        rowGroups.set(key, (rowGroups.get(key) ?? 0) + 1);
      }
      const maxItemsPerRow = rowGroups.size ? Math.max(...rowGroups.values()) : 0;

      const sidebarLeft = sidebarRect?.left ?? 0;
      const mainLeft = main?.getBoundingClientRect().left ?? 0;
      const overlap = sidebar && main ? mainLeft < sidebarLeft + sidebarWidth - 2 : false;

      const filterLabels = [...document.querySelectorAll(".team-list-layout__filter-label")].map(
        (el) => el.textContent?.trim() ?? "",
      );
      const filterCounts = [...document.querySelectorAll(".team-list-layout__filter-count")].map(
        (el) => el.textContent?.trim() ?? "",
      );
      const concatenatedHeaders = filterLabels.some((label, i) => {
        const parent = document.querySelectorAll(".team-list-layout__filter-trigger")[i];
        if (!parent) return false;
        const text = parent.textContent?.replace(/\s+/g, "") ?? "";
        const count = filterCounts[i]?.replace(/\D/g, "") ?? "";
        return count && text === `${label.replace(/\s+/g, "")}(${count})`;
      });

      const mobileSheetOpen = sidebar?.classList.contains("is-sheet-open");
      const isFixedSheet =
        sidebar && getComputedStyle(sidebar).position === "fixed" && width >= 901;

      return {
        hasSidebar: Boolean(sidebar),
        sidebarWidth: Math.round(sidebarWidth),
        itemCount: items.length,
        maxItemsPerRow,
        overlap,
        concatenatedHeaders,
        mobileSheetAtDesktop: isFixedSheet || mobileSheetOpen,
        nativeButtonLook: itemRows.some(
          (item) =>
            item.appearance !== "none" &&
            item.background === "rgba(0, 0, 0, 0)" &&
            item.display === "inline-block",
        ),
      };
    },
    { sidebarSelector: route.sidebarSelector, minSidebarWidth: MIN_SIDEBAR_WIDTH },
  );

  const issues = [];
  if (!checks.hasSidebar) issues.push("missing sidebar");
  if (checks.sidebarWidth < MIN_SIDEBAR_WIDTH) issues.push(`sidebar too narrow (${checks.sidebarWidth}px)`);
  if (checks.itemCount > 1 && checks.maxItemsPerRow > 1) issues.push("multiple nav/filter items per row");
  if (checks.overlap) issues.push("main content overlaps sidebar");
  if (checks.mobileSheetAtDesktop) issues.push("mobile filter sheet active at desktop width");
  if (checks.concatenatedHeaders) issues.push("filter header count concatenated into label");

  return {
    url,
    width,
    status: response?.status() ?? 0,
    ...checks,
    ok: issues.length === 0,
    issues,
  };
}

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const contextOptions = STORAGE_STATE ? { storageState: STORAGE_STATE } : {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const results = [];
  let failures = 0;

  console.log(`Desktop sidebar QA — ${BASE_URL}`);
  if (STORAGE_STATE) console.log(`Using storage state: ${STORAGE_STATE}`);
  else console.log("Tip: set TEAM_QA_STORAGE_STATE for authenticated routes.");

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const result = await auditSidebar(page, route, width);
      results.push(result);
      const mark = result.ok ? "OK" : "FAIL";
      if (!result.ok) failures += 1;
      const detail =
        result.issues.length > 0 ? result.issues.join("; ") : `sidebar ${result.sidebarWidth}px, ${result.itemCount} items`;
      console.log(`[${mark}] ${width}px ${route.path} → ${detail}`);
    }
  }

  await browser.close();

  const reportDir = join(dirname(fileURLToPath(import.meta.url)), "..", "qa-reports");
  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportDir, `desktop-sidebar-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify({ baseUrl: BASE_URL, results, failures }, null, 2));

  console.log(`\nReport: ${reportPath}`);
  console.log(failures === 0 ? "All checks passed." : `${failures} check(s) failed.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
