#!/usr/bin/env node
/**
 * Mobile viewport QA — asserts zero horizontal page scroll at target widths.
 *
 * Usage:
 *   npm run qa:mobile-viewport --workspace apps/team
 *   TEAM_QA_BASE_URL=http://localhost:4322/team npm run qa:mobile-viewport --workspace apps/team
 *
 * Authenticated routes: set TEAM_QA_STORAGE_STATE to a Playwright storageState JSON path
 * after logging in once with `npx playwright codegen --save-storage=team-auth.json`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTHS = [320, 360, 390, 412, 430];
const ZOOM_LEVELS = (process.env.TEAM_QA_ZOOM ?? "1,2")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => value > 0);
const ROUTES = [
  "/login",
  "/",
  "/book",
  "/clients",
  "/inventory",
  "/tasks",
  "/events",
  "/docs",
  "/reports",
  "/manage",
];

const BASE_URL = (process.env.TEAM_QA_BASE_URL ?? "http://localhost:4322/team").replace(/\/$/, "");
const STORAGE_STATE = process.env.TEAM_QA_STORAGE_STATE;

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

function overflowPx(pageWidth, scrollWidth) {
  return Math.max(0, scrollWidth - pageWidth);
}

async function checkRoute(page, url, width, zoom = 1) {
  await page.setViewportSize({ width, height: 800 });
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  if (zoom !== 1) {
    await page.evaluate((z) => {
      document.documentElement.style.zoom = String(z);
    }, zoom);
  }
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    title: document.title,
    path: location.pathname,
  }));

  const overflow = overflowPx(metrics.clientWidth, metrics.scrollWidth);
  return {
    url,
    width,
    zoom,
    status: response?.status() ?? 0,
    finalPath: metrics.path,
    title: metrics.title,
    overflow,
    ok: overflow <= 1,
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

  console.log(`Mobile viewport QA — ${BASE_URL}`);
  if (STORAGE_STATE) console.log(`Using storage state: ${STORAGE_STATE}`);
  else console.log("Tip: set TEAM_QA_STORAGE_STATE for authenticated routes.");
  if (ZOOM_LEVELS.some((z) => z > 1)) {
    console.log(`Zoom levels: ${ZOOM_LEVELS.join(", ")} (200% reflow check — Fix #40)`);
  }

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    for (const width of WIDTHS) {
      const zooms = width === 390 ? ZOOM_LEVELS : [1];
      for (const zoom of zooms) {
        const result = await checkRoute(page, url, width, zoom);
        results.push(result);
        const mark = result.ok ? "OK" : "FAIL";
        if (!result.ok) failures += 1;
        const zoomLabel = zoom === 1 ? "" : ` @${zoom}x`;
        console.log(
          `[${mark}] ${width}px${zoomLabel} ${route} → overflow ${result.overflow}px (${result.finalPath}, ${result.status})`,
        );
      }
    }
  }

  await browser.close();

  const reportDir = join(dirname(fileURLToPath(import.meta.url)), "..", "qa-reports");
  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportDir, `mobile-viewport-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify({ baseUrl: BASE_URL, results, failures }, null, 2));

  console.log(`\nReport: ${reportPath}`);
  console.log(failures === 0 ? "All checks passed." : `${failures} overflow failure(s).`);

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
