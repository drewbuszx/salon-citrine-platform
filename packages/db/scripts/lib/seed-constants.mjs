/**
 * Shared staff + service ID helpers for seed generation and GlossGenius sync.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = join(__dirname, "..", "..");
export const menuPath = join(root, "seed", "data", "menu-services.json");

export const STAFF = [
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

export const GLOSSGENIUS_BOOKING_URL =
  "https://saloncitrineindy.glossgenius.com/booking-flow";

/** Normalize service names for GlossGenius ↔ menu matching. */
export function normalizeServiceName(name) {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

export function serviceId(category, name, index) {
  // Match Supabase services.id format: 4-digit hex sort key + "0000" suffix (12 chars total).
  const sortKey = (index + 1).toString(16).padStart(4, "0");
  const tail = `${sortKey}0000`.padStart(12, "0");
  const catHash = [...category].reduce((a, c) => a + c.charCodeAt(0), 0) % 256;
  const catHex = catHash.toString(16).padStart(2, "0");
  return `b2000001-${catHex}00-4000-8000-${tail}`;
}

/** Build menu service rows with stable IDs (same logic as generate-seed). */
export function buildServiceRows(menu = JSON.parse(readFileSync(menuPath, "utf8"))) {
  let sortOrder = 0;
  const rows = [];
  for (const category of menu) {
    for (const svc of category.services) {
      sortOrder += 1;
      rows.push({
        id: serviceId(category.name, svc.name, sortOrder),
        category: category.name,
        name: svc.name,
        normalizedName: normalizeServiceName(svc.name),
        sortOrder,
      });
    }
  }
  return rows;
}

/** Map normalized service name → seed service row. */
export function buildServiceNameMap(serviceRows = buildServiceRows()) {
  const map = new Map();
  for (const row of serviceRows) {
    map.set(row.normalizedName, row);
  }
  return map;
}
