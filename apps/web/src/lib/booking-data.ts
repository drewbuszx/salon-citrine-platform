import type { Service, Staff } from "@saloncitrine/shared";
import { createSupabaseClient } from "./supabase";

type StaffRow = {
  id: string;
  slug: string;
  name: string;
  role: Staff["role"];
  bio: string | null;
  photo_url: string | null;
  glossgenius_token: string | null;
  is_bookable: boolean;
};

type ServiceRow = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  base_price_cents: number | null;
  duration_minutes: number;
  price_varies: boolean;
  is_addon: boolean;
  requires_consultation: boolean;
  is_active: boolean;
  sort_order: number;
};

function mapStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    role: row.role,
    bio: row.bio,
    photoUrl: row.photo_url,
    glossgeniusToken: row.glossgenius_token,
    isBookable: row.is_bookable,
  };
}

function mapService(row: ServiceRow): Service {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description,
    basePriceCents: row.base_price_cents,
    durationMinutes: row.duration_minutes,
    priceVaries: row.price_varies,
    isAddon: row.is_addon,
    requiresConsultation: row.requires_consultation,
    isActive: row.is_active,
  };
}

export async function fetchServices(): Promise<Service[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .eq("is_addon", false)
    .order("sort_order");

  if (error) throw error;
  return (data as ServiceRow[]).map(mapService);
}

export async function fetchBookableStaff(): Promise<Staff[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("is_bookable", true)
    .order("name");

  if (error) throw error;
  return (data as StaffRow[]).map(mapStaff);
}

export async function getServiceById(
  id: string | null,
): Promise<Service | undefined> {
  if (!id) return undefined;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapService(data as ServiceRow) : undefined;
}

export async function getStaffBySlug(
  slug: string | null,
): Promise<Staff | undefined> {
  if (!slug) return undefined;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("slug", slug)
    .eq("is_bookable", true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapStaff(data as StaffRow) : undefined;
}

export function filterStaffForService(
  staff: Staff[],
  service: Service,
  preselected?: Staff,
): Staff[] {
  if (preselected) return [preselected];

  return staff.filter((member) =>
    member.role === "esthetician"
      ? /Skincare|Waxing|Makeup/i.test(service.category)
      : !/^Skincare|^Makeup/i.test(service.category),
  );
}

export function formatPrice(service: Service): string {
  if (service.basePriceCents === null) return "Complimentary";
  const dollars = service.basePriceCents / 100;
  const base = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  return service.priceVaries ? `${base}+` : base;
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
