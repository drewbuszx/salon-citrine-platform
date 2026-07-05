/**
 * Boulevard Client API shapes mirrored for Salon Citrine native booking.
 * Reference: https://developers.joinblvd.com/graphql-client-api/
 * SDK: https://boulevard.github.io/book-sdk/
 */

/** Boulevard CartBookableDate */
export type BookableDate = {
  /** YYYY-MM-DD in location timezone */
  date: string;
  bookable: boolean;
};

/** Boulevard CartBookableTime */
export type BookableTime = {
  /** Stable id for reservation (we use startsAt ISO) */
  id: string;
  /** UTC ISO start */
  startTime: string;
  /** UTC ISO end (start + total service duration) */
  endTime: string;
  bookable: boolean;
};

/** Legacy slot shape kept for backward compatibility */
export type LegacyTimeSlot = {
  label: string;
  startsAt: string;
};

export type AvailabilityDatesResponse = {
  /** Legacy */
  dates: string[];
  /** Boulevard-aligned */
  bookableDates: BookableDate[];
};

export type AvailabilitySlotsResponse = {
  /** Legacy */
  slots: LegacyTimeSlot[];
  /** Boulevard-aligned */
  bookableTimes: BookableTime[];
  /** Cart reservation TTL hint (minutes) */
  reservationExpiresInMinutes: number;
};

export type BookingCartItem = {
  id: string;
  serviceId: string;
  staffId: string | null;
  name: string;
  durationMinutes: number;
  priceCents: number | null;
  isAddon: boolean;
  sortOrder: number;
  optionIds: string[];
};

export type BookingCartSummary = {
  lineCount: number;
  totalDurationMinutes: number;
  subtotalCents: number;
  depositRequiredCents: number;
};

/** Mirrors Boulevard Cart fields we persist natively */
export type BookingCart = {
  id: string;
  sessionToken: string;
  locationId: string;
  staffId: string | null;
  status: "open" | "reserved" | "completed" | "expired";
  startsAt: string | null;
  endsAt: string | null;
  expiresAt: string | null;
  clientInformation: {
    email: string | null;
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  clientMessage: string | null;
  referralSource: string | null;
  selectedItems: BookingCartItem[];
  summary: BookingCartSummary;
  errors: Array<{ code: string; message: string }>;
};

/** Boulevard appointment lifecycle (subset we implement) */
export const BOULEVARD_APPOINTMENT_STATUSES = [
  "booked",
  "pending",
  "confirmed",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type BoulevardAppointmentStatus =
  (typeof BOULEVARD_APPOINTMENT_STATUSES)[number];

/** Default temporary hold after reserveBookableItems (Boulevard uses cart.expiresAt) */
export const CART_RESERVATION_MINUTES = 15;
