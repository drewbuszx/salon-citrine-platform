/**
 * Salon Citrine business constants.
 * All datetimes are stored in UTC; TIMEZONE is for display only.
 */

export const BUSINESS = {
  name: "Salon Citrine",
  tagline:
    "Hairdressing rooted in inclusion, creativity, and simple beauty for everyone. ♡",
  domain: "saloncitrineindy.com",
  phone: "(317) 476-5375",
  phoneE164: "+13174765375",
  email: "sayhello@saloncitrineindy.com",
  bookingEmail: "bookings@saloncitrineindy.com",
  instagram: "https://www.instagram.com/Saloncitrineindy",
  address: {
    street: "203 S. Audubon Rd",
    city: "Indianapolis",
    state: "IN",
    zip: "46219",
    lat: 39.7677018,
    lng: -86.070018,
  },
} as const;

export const TIMEZONE = "America/Indiana/Indianapolis";

/**
 * Weekly business hours, local time (24h "HH:MM"), keyed by ISO day of week
 * where 0 = Sunday … 6 = Saturday. `null` = closed.
 */
export const BUSINESS_HOURS: Record<
  number,
  { open: string; close: string } | null
> = {
  0: null, // Sunday
  1: null, // Monday
  2: { open: "10:00", close: "20:00" }, // Tuesday
  3: { open: "10:00", close: "20:00" }, // Wednesday
  4: { open: "10:00", close: "20:00" }, // Thursday
  5: { open: "10:00", close: "17:00" }, // Friday
  6: { open: "10:00", close: "17:00" }, // Saturday
};

export const CANCELLATION_POLICY = {
  rescheduleCutoffHours: 48,
  lateCancelFeePercent: 50,
  noShowFeePercent: 100,
  lateGraceMinutes: 15,
  feesWaivedIfRescheduledSameWeek: true,
} as const;

export const STAFF_SLUGS = [
  "lily-gleitsman",
  "miriam-zhukov",
  "andra-kramer",
  "shelby-craft",
  "jules-hoffman",
  "brie-crowe",
  "julie-powers",
] as const;

export type StaffSlug = (typeof STAFF_SLUGS)[number];

/** Seed reference data for staff (matches packages/db seed) */
export const STAFF_MEMBERS = [
  { slug: "lily-gleitsman", name: "Lily Gleitsman", role: "owner" as const },
  { slug: "miriam-zhukov", name: "Miriam Zhukov", role: "owner" as const },
  { slug: "andra-kramer", name: "Andra Kramer", role: "owner" as const },
  {
    slug: "shelby-craft",
    name: "Shelby Craft",
    role: "stylist" as const,
  },
  {
    slug: "jules-hoffman",
    name: "Jules Hoffman",
    role: "stylist" as const,
  },
  { slug: "brie-crowe", name: "Brie Crowe", role: "stylist" as const },
  {
    slug: "julie-powers",
    name: "Julie Powers",
    role: "esthetician" as const,
  },
] as const;
