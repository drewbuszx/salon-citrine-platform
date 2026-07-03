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

type StaffServiceRow = {
  staff_id: string;
  service_id: string;
};

export type BookingCatalog = {
  staff: Staff[];
  categories: string[];
  services: Service[];
  /** staffId → serviceIds this provider offers */
  staffServiceIds: Record<string, string[]>;
};

const ANY_PROFESSIONAL = "";

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

export async function fetchBookingCatalog(): Promise<BookingCatalog> {
  const supabase = createSupabaseClient();

  const [staffResult, servicesResult, staffServicesResult] = await Promise.all([
    supabase.from("staff").select("*").eq("is_bookable", true).order("name"),
    supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .eq("is_addon", false)
      .order("sort_order"),
    supabase.from("staff_services").select("staff_id, service_id"),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (staffServicesResult.error) throw staffServicesResult.error;

  const staff = (staffResult.data as StaffRow[]).map(mapStaff);
  const services = (servicesResult.data as ServiceRow[]).map(mapService);
  const staffServiceIds: Record<string, string[]> = {};

  for (const row of staffServicesResult.data as StaffServiceRow[]) {
    const list = staffServiceIds[row.staff_id] ?? [];
    list.push(row.service_id);
    staffServiceIds[row.staff_id] = list;
  }

  const categories = [
    ...new Set(services.map((service) => service.category)),
  ].sort((a, b) => a.localeCompare(b));

  return { staff, categories, services, staffServiceIds };
}

export async function fetchServices(): Promise<Service[]> {
  const { services } = await fetchBookingCatalog();
  return services;
}

export async function fetchBookableStaff(): Promise<Staff[]> {
  const { staff } = await fetchBookingCatalog();
  return staff;
}

export async function fetchServiceCategories(): Promise<string[]> {
  const { categories } = await fetchBookingCatalog();
  return categories;
}

export function filterServicesForBooking(
  catalog: BookingCatalog,
  staffSlug: string | null,
  category: string | null,
): Service[] {
  const { services, staff, staffServiceIds } = catalog;
  let filtered = services;

  if (staffSlug) {
    const member = staff.find((s) => s.slug === staffSlug);
    if (member) {
      const allowed = new Set(staffServiceIds[member.id] ?? []);
      filtered = filtered.filter((service) => allowed.has(service.id));
    }
  }

  if (category) {
    filtered = filtered.filter((service) => service.category === category);
  }

  return filtered;
}

export function categoriesForStaff(
  catalog: BookingCatalog,
  staffSlug: string | null,
): string[] {
  const services = filterServicesForBooking(catalog, staffSlug, null);
  return [...new Set(services.map((service) => service.category))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function serviceOptionsLabel(service: Service): string | null {
  if (service.priceVaries) return "Multiple options";
  return null;
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

export async function fetchStaffForService(
  serviceId: string,
  preselected?: Staff,
): Promise<Staff[]> {
  if (preselected) return [preselected];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id, staff(*)")
    .eq("service_id", serviceId);

  if (error) throw error;

  const staff: Staff[] = [];
  for (const row of data ?? []) {
    const raw = row.staff as StaffRow | StaffRow[] | null;
    const staffRow = Array.isArray(raw) ? raw[0] : raw;
    if (staffRow?.is_bookable) {
      staff.push(mapStaff(staffRow));
    }
  }

  return staff.sort((a, b) => a.name.localeCompare(b.name));
}

/** @deprecated Use fetchStaffForService — kept for backwards compatibility */
export function filterStaffForService(
  staff: Staff[],
  service: Service,
  preselected?: Staff,
): Staff[] {
  void service;
  if (preselected) return [preselected];
  return staff;
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

export { ANY_PROFESSIONAL };
