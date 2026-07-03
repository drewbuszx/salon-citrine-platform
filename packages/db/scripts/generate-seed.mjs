/**
 * Generates seed/seed.sql from seed/data/menu-services.json + salon reference data.
 * staff_services come from GlossGenius per-stylist data (see sync-staff-services-from-glossgenius.mjs).
 * Run: npm run db:generate-seed
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  STAFF,
  root,
  menuPath,
  buildServiceRows,
} from "./lib/seed-constants.mjs";
import {
  syncStaffServicesFromGlossGenius,
  flattenStaffServiceRows,
} from "./sync-staff-services-from-glossgenius.mjs";

const outPath = join(root, "seed", "seed.sql");
const staffServicesPath = join(root, "seed", "data", "staff-services-glossgenius.json");

/** Salon business hours: 0=Sun … 6=Sat; null = closed */
const SCHEDULE = {
  0: null,
  1: null,
  2: { open: "10:00", close: "20:00" },
  3: { open: "10:00", close: "20:00" },
  4: { open: "10:00", close: "20:00" },
  5: { open: "10:00", close: "17:00" },
  6: { open: "10:00", close: "17:00" },
};

const POLICIES = [
  {
    slug: "cancellation",
    title: "Cancellation Policy",
    sort_order: 1,
    body: `Reschedule 48+ hours before your appointment to avoid a fee. Cancel within 48 hours: 50% charge. No-show: 100% charge. Arriving 15+ minutes late without contact counts as a no-show. Fees are waived if you reschedule within the same week. A card on file is required to secure your booking.`,
  },
  {
    slug: "consultation",
    title: "Consultation Policy",
    sort_order: 2,
    body: `All full service appointments include a consultation. Color consultations are required before big transformations. Consultation fees apply toward your first full service when booked.`,
  },
  {
    slug: "pricing",
    title: "Pricing Policy",
    sort_order: 3,
    body: `Prices with a + are starting rates and may vary based on hair length, density, and stylist level. See the full service menu when booking online.`,
  },
  {
    slug: "booking",
    title: "Booking Policy",
    sort_order: 4,
    body: `Appointments are booked through the online scheduling system. A card on file may be required to secure your booking.`,
  },
];

function sqlEscape(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parsePrice(price) {
  if (!price) return { cents: null, varies: false };
  const lower = price.toLowerCase();
  if (lower.includes("complimentary") || lower === "free") {
    return { cents: null, varies: false };
  }
  const varies = price.includes("+");
  const match = price.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (!match) return { cents: null, varies: false };
  const dollars = parseFloat(match[1].replace(/,/g, ""));
  return { cents: Math.round(dollars * 100), varies };
}

function inferDuration(name, category) {
  const n = name.toUpperCase();
  if (n.includes("CONSULTATION")) return 15;
  if (n.includes("ADD-ON") || n.includes("FRINGE") || n.includes("MAINTENANCE"))
    return 30;
  if (category.includes("Waxing")) return 30;
  if (n.includes("90")) return 90;
  if (n.includes("60")) return 60;
  if (category.includes("Skincare") || category.includes("Makeup")) return 60;
  if (category.includes("Color")) return 120;
  return 60;
}

function isAddon(name, description) {
  if (name.toUpperCase().startsWith("ADD-ON")) return true;
  const d = (description || "").toUpperCase();
  return d.includes("NOT A STANDALONE");
}

function requiresConsultation(name, description) {
  const n = name.toUpperCase();
  const d = (description || "").toUpperCase();
  if (n.includes("CONSULTATION")) return false;
  return (
    (d.includes("REQUIRES A") && d.includes("CONSULTATION")) ||
    d.includes("REQUIRED BEFORE") ||
    n.includes("VIVID TRANSFORMATION")
  );
}

async function loadStaffServices() {
  if (!existsSync(staffServicesPath)) {
    console.log("staff-services-glossgenius.json not found — fetching from GlossGenius…");
    return syncStaffServicesFromGlossGenius({ writeJson: true });
  }
  return JSON.parse(readFileSync(staffServicesPath, "utf8"));
}

const menu = JSON.parse(readFileSync(menuPath, "utf8"));
const serviceRows = buildServiceRows(menu);
const syncResult = await loadStaffServices();
const staffServiceRows = flattenStaffServiceRows(syncResult);

const lines = [
  "-- Salon Citrine seed data (generated — do not edit by hand)",
  "-- Regenerate: npm run db:generate-seed",
  `-- staff_services synced from GlossGenius at ${syncResult.generated_at}`,
  "",
  "begin;",
  "",
  "truncate table public.appointment_services, public.appointments, public.clients,",
  "  public.blocked_times, public.staff_schedules, public.staff_services,",
  "  public.services, public.staff, public.policies restart identity cascade;",
  "",
  "-- staff",
];

for (const s of STAFF) {
  lines.push(
    `insert into public.staff (id, slug, name, role, bio, photo_url, glossgenius_token, is_bookable) values (${sqlEscape(s.id)}, ${sqlEscape(s.slug)}, ${sqlEscape(s.name)}, ${sqlEscape(s.role)}, ${sqlEscape(s.bio)}, ${sqlEscape(s.photo_url)}, ${sqlEscape(s.glossgenius_token)}, true);`,
  );
}

lines.push("", "-- staff_schedules (salon business hours for all bookable staff)");
for (const s of STAFF) {
  for (const [day, hours] of Object.entries(SCHEDULE)) {
    if (!hours) continue;
    lines.push(
      `insert into public.staff_schedules (staff_id, day_of_week, start_time, end_time) values (${sqlEscape(s.id)}, ${day}, '${hours.open}', '${hours.close}');`,
    );
  }
}

lines.push("", "-- policies");
for (const p of POLICIES) {
  lines.push(
    `insert into public.policies (slug, title, body, sort_order) values (${sqlEscape(p.slug)}, ${sqlEscape(p.title)}, ${sqlEscape(p.body)}, ${p.sort_order});`,
  );
}

lines.push("", "-- services");

for (const category of menu) {
  for (const svc of category.services) {
    const row = serviceRows.find(
      (r) => r.category === category.name && r.name === svc.name,
    );
    const { cents, varies } = parsePrice(svc.price);
    const addon = isAddon(svc.name, svc.description);
    const consult = requiresConsultation(svc.name, svc.description);
    const duration = inferDuration(svc.name, category.name);

    lines.push(
      `insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values (${sqlEscape(row.id)}, ${sqlEscape(category.name)}, ${sqlEscape(svc.name)}, ${sqlEscape(svc.description)}, ${cents ?? "null"}, ${duration}, ${varies}, ${addon}, ${consult}, ${row.sortOrder});`,
    );
  }
}

lines.push("", "-- staff_services (per-stylist assignments from GlossGenius)");
for (const row of staffServiceRows) {
  lines.push(
    `insert into public.staff_services (staff_id, service_id) values (${sqlEscape(row.staff_id)}, ${sqlEscape(row.service_id)});`,
  );
}

lines.push("", "commit;", "");
writeFileSync(outPath, lines.join("\n"), "utf8");

const summary = syncResult.staff
  .map((s) => `${s.staff_name}: ${s.matched_service_count}`)
  .join(", ");
console.log(
  `Wrote ${outPath} (${serviceRows.length} services, ${staffServiceRows.length} staff_services — ${summary})`,
);
