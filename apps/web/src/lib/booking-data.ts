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
  accepting_new_clients?: boolean | null;
};

/** URL param set when an existing client confirms the new-client booking gate. */
export const EXISTING_CLIENT_ACK_PARAM = "existing";

export function staffFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

export function hasExistingClientAck(searchParams: URLSearchParams): boolean {
  return searchParams.get(EXISTING_CLIENT_ACK_PARAM) === "1";
}

export function isAcceptingNewClients(staff: Staff): boolean {
  return staff.acceptingNewClients !== false;
}

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
  returning_clients_only: boolean;
  client_booking_block: "none" | "soft" | "hard";
};

export type ClientBookingBlock = "none" | "soft" | "hard";

export function isClientBookable(block: ClientBookingBlock | null | undefined): boolean {
  return (block ?? "none") === "none";
}

export type BookingCatalog = {
  staff: Staff[];
  categories: string[];
  services: Service[];
  /** staffId → serviceIds this provider offers */
  staffServiceIds: Record<string, string[]>;
  /** `${staffId}:${serviceId}` → returning clients only */
  staffServiceReturningOnly: Record<string, boolean>;
};

export function staffServiceKey(staffId: string, serviceId: string): string {
  return `${staffId}:${serviceId}`;
}

export function isReturningClientsOnly(
  catalog: BookingCatalog,
  staffId: string,
  serviceId: string,
): boolean {
  return catalog.staffServiceReturningOnly[staffServiceKey(staffId, serviceId)] ?? false;
}

const ANY_PROFESSIONAL = "";

/** GlossGenius dropdown label for the unfiltered category option. */
export const VIEW_ALL_LABEL = "View All";

/**
 * Category order for hair stylists (owners + stylists) in GlossGenius.
 * DB `services.category` values match these labels (see menu-services.json).
 */
export const HAIR_STYLIST_CATEGORY_ORDER = [
  "Color- Bleach & Tone",
  "Color- Dimensional Color",
  "Color- Single Color & Root Touch Ups",
  "Color- Vivids / Fashion Colors",
  "Hair Consultations",
  "Hair Treatments",
  "Haircuts",
] as const;

/** Category order for estheticians in GlossGenius (after any hair categories). */
export const ESTHETICIAN_CATEGORY_ORDER = [
  "Makeup Services",
  "Skincare Services",
  "Waxing Services",
] as const;

/** Maps DB category values to GlossGenius display labels (identity for current seed data). */
export const SERVICE_CATEGORY_TO_DISPLAY: Record<string, string> = {
  Haircuts: "Haircuts",
  "Color- Dimensional Color": "Color- Dimensional Color",
  "Color- Bleach & Tone": "Color- Bleach & Tone",
  "Color- Single Color & Root Touch Ups": "Color- Single Color & Root Touch Ups",
  "Color- Vivids / Fashion Colors": "Color- Vivids / Fashion Colors",
  "Hair Treatments": "Hair Treatments",
  "Hair Consultations": "Hair Consultations",
  "Waxing Services": "Waxing Services",
  "Skincare Services": "Skincare Services",
  "Makeup Services": "Makeup Services",
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
    acceptingNewClients: row.accepting_new_clients !== false,
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
    supabase
      .from("staff_services")
      .select("staff_id, service_id, returning_clients_only, client_booking_block"),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (staffServicesResult.error) throw staffServicesResult.error;

  const staff = (staffResult.data as StaffRow[]).map(mapStaff);
  const services = (servicesResult.data as ServiceRow[]).map(mapService);
  const staffServiceIds: Record<string, string[]> = {};
  const staffServiceReturningOnly: Record<string, boolean> = {};

  for (const row of staffServicesResult.data as StaffServiceRow[]) {
    if (!isClientBookable(row.client_booking_block)) {
      continue;
    }
    const list = staffServiceIds[row.staff_id] ?? [];
    list.push(row.service_id);
    staffServiceIds[row.staff_id] = list;
    if (row.returning_clients_only) {
      staffServiceReturningOnly[staffServiceKey(row.staff_id, row.service_id)] =
        true;
    }
  }

  const catalog: BookingCatalog = {
    staff,
    categories: [],
    services,
    staffServiceIds,
    staffServiceReturningOnly,
  };
  catalog.categories = getCategoriesForStaff(catalog, null);

  return catalog;
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
    filtered = filtered.filter(
      (service) => service.category === category,
    );
  }

  return filtered;
}

export function getCategoryDisplayLabel(dbCategory: string): string {
  return SERVICE_CATEGORY_TO_DISPLAY[dbCategory] ?? dbCategory;
}

function orderAvailableCategories(
  available: Set<string>,
  order: readonly string[],
): string[] {
  return order.filter((category) => available.has(category));
}

export function getCategoriesForStaff(
  catalog: BookingCatalog,
  staffSlug: string | null,
): string[] {
  const services = filterServicesForBooking(catalog, staffSlug, null);
  const available = new Set(services.map((service) => service.category));

  if (!staffSlug) {
    const hair = orderAvailableCategories(
      available,
      HAIR_STYLIST_CATEGORY_ORDER,
    );
    const hairSet = new Set<string>(HAIR_STYLIST_CATEGORY_ORDER);
    const esthetician = orderAvailableCategories(
      available,
      ESTHETICIAN_CATEGORY_ORDER,
    ).filter((category) => !hairSet.has(category));
    return [...hair, ...esthetician];
  }

  const member = catalog.staff.find((s) => s.slug === staffSlug);
  if (!member) {
    return orderAvailableCategories(available, [
      ...HAIR_STYLIST_CATEGORY_ORDER,
      ...ESTHETICIAN_CATEGORY_ORDER,
    ]);
  }

  if (member.role === "esthetician") {
    const hair = orderAvailableCategories(
      available,
      HAIR_STYLIST_CATEGORY_ORDER,
    );
    const esthetician = orderAvailableCategories(
      available,
      ESTHETICIAN_CATEGORY_ORDER,
    );
    return [...hair, ...esthetician];
  }

  return orderAvailableCategories(available, HAIR_STYLIST_CATEGORY_ORDER);
}

/** @deprecated Use getCategoriesForStaff */
export const categoriesForStaff = getCategoriesForStaff;

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

export async function fetchReturningClientsOnly(
  staffSlug: string,
  serviceId: string,
): Promise<boolean> {
  const staff = await getStaffBySlug(staffSlug);
  if (!staff) return false;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("returning_clients_only")
    .eq("staff_id", staff.id)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (error) throw error;
  return data?.returning_clients_only === true;
}

/** staffSlug → true when that provider restricts the service to returning clients */
export async function fetchReturningOnlyStaffSlugs(
  serviceId: string,
): Promise<Set<string>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("returning_clients_only, staff(slug)")
    .eq("service_id", serviceId)
    .eq("returning_clients_only", true);

  if (error) throw error;

  const slugs = new Set<string>();
  for (const row of data ?? []) {
    const raw = row.staff as { slug: string } | { slug: string }[] | null;
    const staffRow = Array.isArray(raw) ? raw[0] : raw;
    if (staffRow?.slug) slugs.add(staffRow.slug);
  }
  return slugs;
}

export async function fetchStaffForService(
  serviceId: string,
  preselected?: Staff,
): Promise<Staff[]> {
  if (preselected) return [preselected];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id, returning_clients_only, client_booking_block, staff(*)")
    .eq("service_id", serviceId);

  if (error) throw error;

  const staff: Staff[] = [];
  for (const row of data ?? []) {
    if (!isClientBookable(row.client_booking_block)) {
      continue;
    }
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

export type CartSuggestions = {
  /** Shown when primary service requires a consultation first */
  requiredConsultation: Service[];
  /** is_addon services the stylist offers */
  addons: Service[];
  /** Optional consultation / test-strand style services */
  consultations: Service[];
  /** Same or related category extras (capped) */
  relatedOptional: Service[];
};

const CONSULTATION_CATEGORIES = new Set(["Hair Consultations"]);

function isConsultationService(service: Service): boolean {
  return (
    CONSULTATION_CATEGORIES.has(service.category) ||
    /consultation|test strand/i.test(service.name)
  );
}

function isRelatedCategory(category: string, primaryCategory: string): boolean {
  if (category === primaryCategory) return true;
  const prefixA = category.split("-")[0]?.trim();
  const prefixB = primaryCategory.split("-")[0]?.trim();
  if (prefixA && prefixB && prefixA === prefixB && prefixA === "Color") return true;
  if (category === "Hair Treatments" && primaryCategory.startsWith("Color"))
    return true;
  return false;
}

/** Parse `services=id1,id2` with fallback to single `service`. */
export function parseServiceIdsFromParams(
  servicesParam: string | null,
  serviceParam: string | null,
): string[] {
  if (servicesParam) {
    const ids = servicesParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > 0) return ids;
  }
  if (serviceParam) return [serviceParam];
  return [];
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  const hrLabel = hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hrLabel} ${minutes} min`;
}

export function sumServiceDuration(services: Service[]): number {
  return services.reduce((sum, svc) => sum + svc.durationMinutes, 0);
}

export function estimateCartPrice(services: Service[]): string | null {
  let totalCents = 0;
  let hasNull = false;
  let hasVaries = false;

  for (const svc of services) {
    if (svc.basePriceCents === null) {
      hasNull = true;
      continue;
    }
    totalCents += svc.basePriceCents;
    if (svc.priceVaries) hasVaries = true;
  }

  if (totalCents === 0 && hasNull) return null;

  const dollars = totalCents / 100;
  const base = `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  if (hasVaries || hasNull) return `${base}+`;
  return base;
}

export async function fetchServicesByIds(
  ids: string[],
  staffSlug?: string | null,
): Promise<Service[]> {
  if (ids.length === 0) return [];

  const supabase = createSupabaseClient();
  let allowedIds: Set<string> | null = null;

  if (staffSlug) {
    const staff = await getStaffBySlug(staffSlug);
    if (staff) {
      const { data, error } = await supabase
        .from("staff_services")
        .select("service_id, client_booking_block")
        .eq("staff_id", staff.id);
      if (error) throw error;
      allowedIds = new Set(
        (data ?? [])
          .filter((row) => isClientBookable(row.client_booking_block))
          .map((row) => row.service_id),
      );
    }
  }

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .in("id", ids)
    .eq("is_active", true);

  if (error) throw error;

  let services = (data as ServiceRow[]).map(mapService);
  if (allowedIds) {
    services = services.filter((svc) => allowedIds!.has(svc.id));
  }

  const order = new Map(ids.map((id, index) => [id, index]));
  return services.sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
}

export async function fetchCartSuggestions(
  staffSlug: string,
  primaryServiceId: string,
): Promise<CartSuggestions> {
  const empty: CartSuggestions = {
    requiredConsultation: [],
    addons: [],
    consultations: [],
    relatedOptional: [],
  };

  const staff = await getStaffBySlug(staffSlug);
  const primary = await getServiceById(primaryServiceId);
  if (!staff || !primary) return empty;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("staff_services")
    .select("service_id, client_booking_block, services(*)")
    .eq("staff_id", staff.id);

  if (error) throw error;

  const staffServices: Service[] = [];
  for (const row of data ?? []) {
    if (!isClientBookable(row.client_booking_block)) continue;
    const raw = row.services as ServiceRow | ServiceRow[] | null;
    const svcRow = Array.isArray(raw) ? raw[0] : raw;
    if (svcRow?.is_active) staffServices.push(mapService(svcRow));
  }

  const available = staffServices.filter((svc) => svc.id !== primaryServiceId);

  let requiredConsultation: Service[] = [];
  if (primary.requiresConsultation) {
    requiredConsultation = available.filter(
      (svc) =>
        isConsultationService(svc) &&
        (svc.category === primary.category ||
          svc.category === "Hair Consultations" ||
          /color consultation/i.test(svc.name)),
    );
    if (requiredConsultation.length === 0) {
      requiredConsultation = available
        .filter(isConsultationService)
        .slice(0, 2);
    }
  }

  const requiredIds = new Set(requiredConsultation.map((svc) => svc.id));

  const addons = available.filter(
    (svc) => svc.isAddon && !requiredIds.has(svc.id),
  );

  const consultations = available
    .filter(
      (svc) =>
        isConsultationService(svc) &&
        !svc.isAddon &&
        !requiredIds.has(svc.id),
    )
    .slice(0, 4);

  const relatedOptional = available
    .filter(
      (svc) =>
        !svc.isAddon &&
        !isConsultationService(svc) &&
        !requiredIds.has(svc.id) &&
        isRelatedCategory(svc.category, primary.category),
    )
    .slice(0, 4);

  return { requiredConsultation, addons, consultations, relatedOptional };
}

export { ANY_PROFESSIONAL };
