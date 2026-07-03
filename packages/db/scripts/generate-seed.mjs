/**
 * Generates seed/seed.sql from seed/data/menu-services.json + salon reference data.
 * Run: npm run db:generate-seed
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const menuPath = join(root, "seed", "data", "menu-services.json");
const outPath = join(root, "seed", "seed.sql");

const STAFF = [
  {
    id: "a1000001-0001-4000-8000-000000000001",
    slug: "lily-gleitsman",
    name: "Lily Gleitsman",
    role: "owner",
    glossgenius_token: "10001-f5bd9a7b-3e2f-4255-951d-ca4881f88678",
    bio: null,
    photo_url: "/images/lily-gleitsman.jpg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000002",
    slug: "miriam-zhukov",
    name: "Miriam Zhukov",
    role: "owner",
    glossgenius_token: "10001-690e87a4-3d1b-44db-a449-08c9d40b5dff",
    bio: null,
    photo_url: "/images/miriam-zhukov.jpg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000003",
    slug: "andra-kramer",
    name: "Andra Kramer",
    role: "owner",
    glossgenius_token: "10001-7e4b7dd5-f741-4f6f-b71d-ed5cc3b638ec",
    bio: null,
    photo_url: "/images/andra-kramer.jpg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000004",
    slug: "shelby-craft",
    name: "Shelby Craft",
    role: "stylist",
    glossgenius_token: "10001-6a29adda-3651-43d9-8899-3ace37524a1e",
    bio: "Specializes in alternative, vivid, edgy styles and low-maintenance natural looks",
    photo_url: "/images/shelby-craft.jpg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000005",
    slug: "jules-hoffman",
    name: "Jules Hoffman",
    role: "stylist",
    glossgenius_token: "10001-40fac3c0-b13b-47c2-86da-6e1c3452329f",
    bio: "Helping you feel like the star you are, one appointment at a time.",
    photo_url: "/images/jules-hoffman.jpg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000006",
    slug: "brie-crowe",
    name: "Brie Crowe",
    role: "stylist",
    glossgenius_token: "10001-32abe5c0-3025-48ed-8516-850b1fc5783f",
    bio: null,
    photo_url: "/images/brie-crowe.jpg",
  },
  {
    id: "a1000001-0001-4000-8000-000000000007",
    slug: "julie-powers",
    name: "Julie Powers",
    role: "esthetician",
    glossgenius_token: "10001-d788dd27-3f49-452f-af8e-c87bb31e94c3",
    bio: "Korean-inspired facials, peels, waxing, and makeup artistry",
    photo_url: "/images/julie-powers.jpg",
  },
];

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
    d.includes("REQUIRES A") && d.includes("CONSULTATION") ||
    d.includes("REQUIRED BEFORE") ||
    n.includes("VIVID TRANSFORMATION")
  );
}

function serviceId(category, name, index) {
  const tail = (index + 1).toString(16).padStart(12, "0");
  const catHash = [...category].reduce((a, c) => a + c.charCodeAt(0), 0) % 256;
  const catHex = catHash.toString(16).padStart(2, "0");
  return `b2000001-${catHex}00-4000-8000-${tail}`;
}

const menu = JSON.parse(readFileSync(menuPath, "utf8"));
const lines = [
  "-- Salon Citrine seed data (generated — do not edit by hand)",
  "-- Regenerate: npm run db:generate-seed",
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
let sortOrder = 0;
const serviceRows = [];

for (const category of menu) {
  for (const svc of category.services) {
    sortOrder += 1;
    const { cents, varies } = parsePrice(svc.price);
    const addon = isAddon(svc.name, svc.description);
    const consult = requiresConsultation(svc.name, svc.description);
    const duration = inferDuration(svc.name, category.name);
    const id = serviceId(category.name, svc.name, sortOrder);

    serviceRows.push({ id, category: category.name, svc, cents, varies, addon, consult, duration, sortOrder });
    lines.push(
      `insert into public.services (id, category, name, description, base_price_cents, duration_minutes, price_varies, is_addon, requires_consultation, sort_order) values (${sqlEscape(id)}, ${sqlEscape(category.name)}, ${sqlEscape(svc.name)}, ${sqlEscape(svc.description)}, ${cents ?? "null"}, ${duration}, ${varies}, ${addon}, ${consult}, ${sortOrder});`,
    );
  }
}

lines.push("", "-- staff_services (all bookable staff × non-add-on services)");
for (const s of STAFF) {
  for (const row of serviceRows) {
    if (row.addon) continue;
    if (s.role === "esthetician" && !row.category.match(/Skincare|Waxing|Makeup|Consultations/i)) continue;
    if (s.role !== "esthetician" && row.category.match(/^Skincare|^Makeup/i)) continue;
    lines.push(
      `insert into public.staff_services (staff_id, service_id) values (${sqlEscape(s.id)}, ${sqlEscape(row.id)});`,
    );
  }
}

lines.push("", "commit;", "");
writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`Wrote ${outPath} (${serviceRows.length} services, ${STAFF.length} staff)`);
