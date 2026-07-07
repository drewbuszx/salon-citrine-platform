import { BUSINESS, BUSINESS_HOURS, TIMEZONE } from "@saloncitrine/shared";

export const DEFAULT_LOCATION_SLUG = "salon-citrine-indy";

export type BusinessHoursDay = { open: string; close: string } | null;

export type BusinessHours = Record<number, BusinessHoursDay>;

export type LocationRow = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  booking_email: string | null;
  tagline: string | null;
  logo_url: string | null;
  instagram_url: string | null;
  business_hours: Record<string, BusinessHoursDay> | null;
  is_active: boolean;
};

export type BusinessDetails = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  bookingEmail: string;
  tagline: string;
  logoUrl: string;
  instagramUrl: string;
  businessHours: BusinessHours;
  isActive: boolean;
};

export const LOCATION_SELECT =
  "id, slug, name, timezone, address_line1, address_line2, city, state, postal_code, phone, email, booking_email, tagline, logo_url, instagram_url, business_hours, is_active";

const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

export function parseBusinessHours(
  raw: Record<string, BusinessHoursDay> | null | undefined,
): BusinessHours {
  const hours: BusinessHours = {};
  for (let day = 0; day <= 6; day += 1) {
    const value = raw?.[String(day)] ?? raw?.[day as unknown as string] ?? null;
    if (
      value &&
      typeof value.open === "string" &&
      typeof value.close === "string"
    ) {
      hours[day] = { open: value.open.slice(0, 5), close: value.close.slice(0, 5) };
    } else {
      hours[day] = null;
    }
  }
  return hours;
}

export function serializeBusinessHours(hours: BusinessHours): Record<string, BusinessHoursDay> {
  const out: Record<string, BusinessHoursDay> = {};
  for (const key of DAY_KEYS) {
    const day = Number(key);
    const value = hours[day] ?? null;
    out[key] = value
      ? { open: value.open.slice(0, 5), close: value.close.slice(0, 5) }
      : null;
  }
  return out;
}

export function defaultBusinessDetails(): BusinessDetails {
  return {
    id: "",
    slug: DEFAULT_LOCATION_SLUG,
    name: BUSINESS.name,
    timezone: TIMEZONE,
    addressLine1: BUSINESS.address.street,
    addressLine2: "",
    city: BUSINESS.address.city,
    state: BUSINESS.address.state,
    postalCode: BUSINESS.address.zip,
    phone: BUSINESS.phone,
    email: BUSINESS.email,
    bookingEmail: BUSINESS.bookingEmail,
    tagline: BUSINESS.tagline,
    logoUrl: "",
    instagramUrl: BUSINESS.instagram,
    businessHours: { ...BUSINESS_HOURS },
    isActive: true,
  };
}

export function mapLocationRow(row: LocationRow): BusinessDetails {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone || TIMEZONE,
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    bookingEmail: row.booking_email ?? "",
    tagline: row.tagline ?? "",
    logoUrl: row.logo_url ?? "",
    instagramUrl: row.instagram_url ?? "",
    businessHours: parseBusinessHours(row.business_hours),
    isActive: row.is_active,
  };
}

export function mapBusinessUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.timezone === "string") updates.timezone = body.timezone.trim();
  if (typeof body.addressLine1 === "string") updates.address_line1 = body.addressLine1.trim();
  if (typeof body.addressLine2 === "string") updates.address_line2 = body.addressLine2.trim();
  if (typeof body.city === "string") updates.city = body.city.trim();
  if (typeof body.state === "string") updates.state = body.state.trim();
  if (typeof body.postalCode === "string") updates.postal_code = body.postalCode.trim();
  if (typeof body.phone === "string") updates.phone = body.phone.trim();
  if (typeof body.email === "string") updates.email = body.email.trim();
  if (typeof body.bookingEmail === "string") updates.booking_email = body.bookingEmail.trim();
  if (typeof body.tagline === "string") updates.tagline = body.tagline.trim();
  if (typeof body.logoUrl === "string") updates.logo_url = body.logoUrl.trim() || null;
  if (typeof body.instagramUrl === "string") updates.instagram_url = body.instagramUrl.trim();
  if (typeof body.isActive === "boolean") updates.is_active = body.isActive;
  if (body.businessHours && typeof body.businessHours === "object") {
    updates.business_hours = serializeBusinessHours(
      body.businessHours as BusinessHours,
    );
  }

  return updates;
}
