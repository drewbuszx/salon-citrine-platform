#!/usr/bin/env node
/**
 * Mobile a11y QA — icon buttons need names, skip link present, focusable controls labeled.
 *
 * Usage:
 *   npm run qa:mobile-a11y --workspace apps/team
 *   TEAM_QA_STORAGE_STATE=team-auth.json npm run qa:mobile-a11y --workspace apps/team
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTHS = [320, 390];
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
    console.error("Playwright is not installed. Run: npm install -D playwright --workspace apps/team");
    process.exit(1);
  }
}

async function auditPage(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  return page.evaluate(() => {
    const issues = [];

    const skip = document.querySelector(".skip-link, a[href='#team-main-content']");
    if (!skip) {
      issues.push({ kind: "skip-link", detail: "Missing skip to main content link" });
    }

    document.querySelectorAll("button, [role='button']").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.closest("[hidden], [aria-hidden='true']")) return;
      const name =
        el.getAttribute("aria-label")?.trim() ||
        el.getAttribute("aria-labelledby") ||
        el.textContent?.trim();
      const hasSvgOnly = !name && el.querySelector("svg") && el.childElementCount <= 2;
      if (hasSvgOnly || (!name && el.querySelector("svg"))) {
        issues.push({
          kind: "icon-button",
          detail: `Button without accessible name: ${el.outerHTML.slice(0, 120)}…`,
        });
      }
    });

    document.querySelectorAll("input:not([type='hidden'])").forEach((el) => {
      if (!(el instanceof HTMLInputElement)) return;
      if (el.type === "submit" || el.type === "button") return;
      const labelled =
        el.labels?.length ||
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("placeholder");
      if (!labelled) {
        issues.push({ kind: "input-label", detail: `Input missing label: name=${el.name || el.id || el.type}` });
      }
    });

    return {
      path: location.pathname,
      title: document.title,
      issueCount: issues.length,
      issues: issues.slice(0, 12),
    };
  });
}

async function main() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(STORAGE_STATE ? { storageState: STORAGE_STATE } : {});
  const page = await context.newPage();

  const results = [];
  let failures = 0;

  console.log(`Mobile a11y QA — ${BASE_URL}`);
  if (!STORAGE_STATE) console.log("Tip: set TEAM_QA_STORAGE_STATE for authenticated routes.");

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      const result = await auditPage(page, url);
      results.push({ width, ...result });
      const mark = result.issueCount === 0 ? "OK" : "FAIL";
      if (result.issueCount > 0) failures += result.issueCount;
      console.log(`[${mark}] ${width}px ${route} — ${result.issueCount} issue(s)`);
      for (const issue of result.issues) {
        console.log(`       · ${issue.kind}: ${issue.detail}`);
      }
    }
  }

  await browser.close();

  const reportDir = join(dirname(fileURLToPath(import.meta.url)), "..", "qa-reports");
  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportDir, `mobile-a11y-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify({ baseUrl: BASE_URL, widths: WIDTHS, results, failures }, null, 2));

  console.log(`\nReport: ${reportPath}`);
  console.log(failures === 0 ? "All checks passed." : `${failures} a11y issue(s).`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
