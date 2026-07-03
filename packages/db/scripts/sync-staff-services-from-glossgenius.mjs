/**
 * Sync staff_services mappings from GlossGenius booking-flow __NEXT_DATA__.
 *
 * Run: npm run db:sync-staff-services
 * Options:
 *   --fetch-only   Fetch and write JSON only (skip console summary)
 *   --html=PATH    Use local HTML instead of fetching (for offline dev)
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STAFF,
  GLOSSGENIUS_BOOKING_URL,
  root,
  buildServiceNameMap,
  normalizeServiceName,
} from "./lib/seed-constants.mjs";

const outPath = join(root, "seed", "data", "staff-services-glossgenius.json");

function parseArgs() {
  const args = process.argv.slice(2);
  let htmlPath = null;
  for (const arg of args) {
    if (arg.startsWith("--html=")) htmlPath = arg.slice("--html=".length);
  }
  return { htmlPath };
}

function extractNextData(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error("__NEXT_DATA__ script tag not found");
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf("</script>", jsonStart);
  if (jsonEnd === -1) throw new Error("__NEXT_DATA__ closing script tag not found");
  return JSON.parse(html.slice(jsonStart, jsonEnd));
}

function findGlossGeniusUsers(nextData) {
  const users =
    nextData?.props?.serverContext?.publicUser?.users ??
    nextData?.props?.pageProps?.serverContext?.publicUser?.users;
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("Could not find publicUser.users in __NEXT_DATA__");
  }
  return users;
}

function matchStaff(ggUser) {
  const byToken = STAFF.find(
    (s) => s.glossgenius_token && s.glossgenius_token === ggUser.user_token,
  );
  if (byToken) return byToken;

  const byName = STAFF.find(
    (s) => normalizeServiceName(s.name) === normalizeServiceName(ggUser.full_name),
  );
  if (byName) return byName;

  return null;
}

export async function syncStaffServicesFromGlossGenius(options = {}) {
  const { htmlPath = null, writeJson = true } = options;

  let html;
  if (htmlPath) {
    const { readFileSync } = await import("node:fs");
    html = readFileSync(htmlPath, "utf8");
  } else {
    const res = await fetch(GLOSSGENIUS_BOOKING_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${GLOSSGENIUS_BOOKING_URL}: ${res.status}`);
    }
    html = await res.text();
  }

  const nextData = extractNextData(html);
  const ggUsers = findGlossGeniusUsers(nextData);
  const serviceNameMap = buildServiceNameMap();

  const staffMappings = [];
  const warnings = [];

  for (const ggUser of ggUsers) {
    const staff = matchStaff(ggUser);
    if (!staff) {
      warnings.push(`No STAFF match for GlossGenius user: ${ggUser.full_name}`);
      continue;
    }

    const matchedServices = [];
    const unmatchedServices = [];

    for (const svc of ggUser.services ?? []) {
      const row = serviceNameMap.get(normalizeServiceName(svc.name));
      if (row) matchedServices.push({ name: row.name, service_id: row.id });
      else unmatchedServices.push(svc.name);
    }

    if (unmatchedServices.length) {
      warnings.push(
        `${staff.name}: ${unmatchedServices.length} GlossGenius service(s) not in menu: ${unmatchedServices.join(", ")}`,
      );
    }

    staffMappings.push({
      staff_id: staff.id,
      staff_slug: staff.slug,
      staff_name: staff.name,
      glossgenius_token: ggUser.user_token ?? staff.glossgenius_token,
      glossgenius_service_count: ggUser.services?.length ?? 0,
      matched_service_count: matchedServices.length,
      unmatched_services: unmatchedServices,
      services: matchedServices,
    });
  }

  for (const s of STAFF) {
    if (!staffMappings.some((m) => m.staff_id === s.id)) {
      warnings.push(`STAFF member missing from GlossGenius: ${s.name}`);
    }
  }

  const result = {
    generated_at: new Date().toISOString(),
    source: htmlPath ? `file://${htmlPath}` : GLOSSGENIUS_BOOKING_URL,
    staff: staffMappings,
    warnings,
  };

  if (writeJson) {
    writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  return result;
}

/** Flat staff_services rows for seed SQL generation. */
export function flattenStaffServiceRows(syncResult) {
  const rows = [];
  for (const staff of syncResult.staff) {
    for (const svc of staff.services) {
      rows.push({ staff_id: staff.staff_id, service_id: svc.service_id });
    }
  }
  return rows;
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { htmlPath } = parseArgs();
  const result = await syncStaffServicesFromGlossGenius({ htmlPath, writeJson: true });

  console.log(`Wrote ${outPath}`);
  for (const s of result.staff) {
    console.log(
      `  ${s.staff_name}: ${s.matched_service_count}/${s.glossgenius_service_count} services matched`,
    );
  }
  if (result.warnings.length) {
    console.warn("\nWarnings:");
    for (const w of result.warnings) console.warn(`  - ${w}`);
  }
}
