/**
 * Static mock data for the placeholder booking flow (Phase 1).
 * Replaced by Supabase API calls once the project is wired up.
 */
import type { Service, Staff } from "@saloncitrine/shared";

export const MOCK_STAFF: Staff[] = [
  {
    id: "a1000001-0001-4000-8000-000000000001",
    slug: "lily-gleitsman",
    name: "Lily Gleitsman",
    role: "owner",
    bio: null,
    photoUrl: "/images/lily-gleitsman.jpg",
    glossgeniusToken: "10001-f5bd9a7b-3e2f-4255-951d-ca4881f88678",
    isBookable: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000002",
    slug: "miriam-zhukov",
    name: "Miriam Zhukov",
    role: "owner",
    bio: null,
    photoUrl: "/images/miriam-zhukov.jpg",
    glossgeniusToken: "10001-690e87a4-3d1b-44db-a449-08c9d40b5dff",
    isBookable: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000003",
    slug: "andra-kramer",
    name: "Andra Kramer",
    role: "owner",
    bio: null,
    photoUrl: "/images/andra-kramer.jpg",
    glossgeniusToken: "10001-7e4b7dd5-f741-4f6f-b71d-ed5cc3b638ec",
    isBookable: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000004",
    slug: "shelby-craft",
    name: "Shelby Craft",
    role: "stylist",
    bio: "Alternative, vivid, edgy styles and low-maintenance natural looks",
    photoUrl: "/images/shelby-craft.jpg",
    glossgeniusToken: "10001-6a29adda-3651-43d9-8899-3ace37524a1e",
    isBookable: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000005",
    slug: "jules-hoffman",
    name: "Jules Hoffman",
    role: "stylist",
    bio: "Helping you feel like the star you are, one appointment at a time.",
    photoUrl: "/images/jules-hoffman.jpg",
    glossgeniusToken: "10001-40fac3c0-b13b-47c2-86da-6e1c3452329f",
    isBookable: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000006",
    slug: "brie-crowe",
    name: "Brie Crowe",
    role: "stylist",
    bio: null,
    photoUrl: "/images/brie-crowe.jpg",
    glossgeniusToken: "10001-32abe5c0-3025-48ed-8516-850b1fc5783f",
    isBookable: true,
  },
  {
    id: "a1000001-0001-4000-8000-000000000007",
    slug: "julie-powers",
    name: "Julie Powers",
    role: "esthetician",
    bio: "Korean-inspired facials, peels, waxing, and makeup artistry",
    photoUrl: "/images/julie-powers.jpg",
    glossgeniusToken: "10001-d788dd27-3f49-452f-af8e-c87bb31e94c3",
    isBookable: true,
  },
];

export const MOCK_SERVICES: Service[] = [
  {
    id: "b2000001-0100-4000-8000-0000000100000001",
    category: "Haircuts",
    name: "NEW CLIENT HAIRCUT",
    description:
      "First time at Salon Citrine? Welcome! Shampoo & blowout included.",
    basePriceCents: 5500,
    durationMinutes: 60,
    priceVaries: true,
    isAddon: false,
    requiresConsultation: false,
    isActive: true,
  },
  {
    id: "b2000001-0100-4000-8000-0000000200000001",
    category: "Haircuts",
    name: "HAIRCUT",
    description: "For returning clients only. Shampoo & blowout included.",
    basePriceCents: 5500,
    durationMinutes: 60,
    priceVaries: true,
    isAddon: false,
    requiresConsultation: false,
    isActive: true,
  },
  {
    id: "b2000001-0200-4000-8000-0000000300000001",
    category: "Color- Dimensional Color",
    name: "FULL DIMENSIONAL COLOR & CUT",
    description: "Full head of dimensional color plus a custom haircut.",
    basePriceCents: 20000,
    durationMinutes: 180,
    priceVaries: true,
    isAddon: false,
    requiresConsultation: false,
    isActive: true,
  },
  {
    id: "b2000001-0300-4000-8000-0000000400000001",
    category: "Color- Vivids",
    name: "COLOR CONSULTATION",
    description: "Required before big color transformations.",
    basePriceCents: 2000,
    durationMinutes: 15,
    priceVaries: false,
    isAddon: false,
    requiresConsultation: false,
    isActive: true,
  },
  {
    id: "b2000001-0400-4000-8000-0000000500000001",
    category: "Skincare",
    name: "BESPOKE KOREAN FACIAL (60 MIN)",
    description: "Customized Korean-inspired facial treatment.",
    basePriceCents: 12500,
    durationMinutes: 60,
    priceVaries: false,
    isAddon: false,
    requiresConsultation: false,
    isActive: true,
  },
];

export const MOCK_TIME_SLOTS = [
  "10:00 AM",
  "11:30 AM",
  "1:00 PM",
  "2:30 PM",
  "4:00 PM",
  "5:30 PM",
];

export function formatPrice(service: Service): string {
  if (service.basePriceCents === null) return "Complimentary";
  const dollars = service.basePriceCents / 100;
  const base = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  return service.priceVaries ? `${base}+` : base;
}

export function getStaffBySlug(slug: string | null): Staff | undefined {
  if (!slug) return undefined;
  return MOCK_STAFF.find((s) => s.slug === slug);
}

export function getServiceById(id: string | null): Service | undefined {
  if (!id) return undefined;
  return MOCK_SERVICES.find((s) => s.id === id);
}

export function groupServicesByCategory(
  services: Service[],
): Map<string, Service[]> {
  const map = new Map<string, Service[]>();
  for (const svc of services) {
    if (svc.isAddon) continue;
    const list = map.get(svc.category) ?? [];
    list.push(svc);
    map.set(svc.category, list);
  }
  return map;
}
