import { withBase } from "./paths";

/** Query keys carried through the booking funnel (Boulevard cart session). */
export const BOOKING_QUERY = {
  service: "service",
  services: "services",
  stylist: "stylist",
  flow: "flow",
  date: "date",
  time: "time",
  startsAt: "startsAt",
  cartId: "cartId",
  returning: "returning",
  existingAck: "existing",
  embed: "embed",
} as const;

export type BookingFlowFlags = {
  showStylistStep?: boolean;
  returningAck?: boolean;
  existingAck?: boolean;
  embed?: boolean;
};

export function bookingFlagsFromUrl(url: URL): BookingFlowFlags {
  const params = url.searchParams;
  return {
    showStylistStep: params.get(BOOKING_QUERY.flow) === "stylist",
    returningAck: params.get(BOOKING_QUERY.returning) === "1",
    existingAck: params.get(BOOKING_QUERY.existingAck) === "1",
    embed: params.get(BOOKING_QUERY.embed) === "1",
  };
}

export function appendFlowFlags(params: URLSearchParams, flags: BookingFlowFlags) {
  if (flags.showStylistStep) params.set(BOOKING_QUERY.flow, "stylist");
  if (flags.returningAck) params.set(BOOKING_QUERY.returning, "1");
  if (flags.existingAck) params.set(BOOKING_QUERY.existingAck, "1");
  if (flags.embed) params.set(BOOKING_QUERY.embed, "1");
}

/** Session flags (embed, ack params) without step-specific flow=stylist. */
export function sessionFlagsFromUrl(url: URL): BookingFlowFlags {
  const flags = bookingFlagsFromUrl(url);
  return {
    returningAck: flags.returningAck,
    existingAck: flags.existingAck,
    embed: flags.embed,
  };
}

/** Service picker landing with optional stylist/category prefill. */
export function serviceIndexUrl(
  flags: BookingFlowFlags = {},
  options: { stylistSlug?: string | null; category?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.stylistSlug) params.set(BOOKING_QUERY.stylist, options.stylistSlug);
  if (options.category) params.set("category", options.category);
  appendFlowFlags(params, flags);
  const qs = params.toString();
  return qs ? `${withBase()}?${qs}` : withBase();
}

/** Preserve embed=1 in client-side navigations when layout sets data-booking-embed on <html>. */
export function appendEmbedIfActive(params: URLSearchParams) {
  if (
    typeof document !== "undefined" &&
    document.documentElement.dataset.bookingEmbed === "1"
  ) {
    params.set(BOOKING_QUERY.embed, "1");
  }
}

export function servicesQueryValue(serviceIds: string[], fallbackSingle?: string | null) {
  if (serviceIds.length > 0) return serviceIds.join(",");
  return fallbackSingle ?? "";
}

/** Boulevard SelectServiceFirst: services → cart */
export function cartUrl(
  serviceIds: string[],
  stylistSlug?: string | null,
  flags: BookingFlowFlags = {},
): string {
  const params = new URLSearchParams();
  const services = servicesQueryValue(serviceIds);
  if (services) params.set(BOOKING_QUERY.services, services);
  else if (serviceIds[0]) params.set(BOOKING_QUERY.service, serviceIds[0]);
  if (stylistSlug) params.set(BOOKING_QUERY.stylist, stylistSlug);
  appendFlowFlags(params, flags);
  return `${withBase("cart/")}?${params.toString()}`;
}

/** After cart: pick staff variant (any professional path). */
export function stylistUrl(
  serviceIds: string[],
  flags: BookingFlowFlags = {},
): string {
  const params = new URLSearchParams();
  const services = servicesQueryValue(serviceIds);
  if (services) params.set(BOOKING_QUERY.services, services);
  if (serviceIds[0]) params.set(BOOKING_QUERY.service, serviceIds[0]);
  appendFlowFlags(params, flags);
  return `${withBase("stylist/")}?${params.toString()}`;
}

/** getBookableDates / reserveBookableItems */
export function datetimeUrl(
  serviceIds: string[],
  stylistSlug: string,
  flags: BookingFlowFlags = {},
): string {
  const params = new URLSearchParams();
  const services = servicesQueryValue(serviceIds);
  if (services) params.set(BOOKING_QUERY.services, services);
  if (serviceIds[0]) params.set(BOOKING_QUERY.service, serviceIds[0]);
  params.set(BOOKING_QUERY.stylist, stylistSlug);
  appendFlowFlags(params, flags);
  return `${withBase("datetime/")}?${params.toString()}`;
}

/** Client info + checkout (Boulevard cart.update + checkout). */
export function detailsUrl(input: {
  serviceIds: string[];
  stylistSlug: string;
  date: string;
  startsAt: string;
  cartId?: string | null;
  flags?: BookingFlowFlags;
}): string {
  const params = new URLSearchParams();
  params.set(BOOKING_QUERY.services, servicesQueryValue(input.serviceIds));
  params.set(BOOKING_QUERY.stylist, input.stylistSlug);
  params.set(BOOKING_QUERY.date, input.date);
  params.set(BOOKING_QUERY.startsAt, input.startsAt);
  if (input.cartId) params.set(BOOKING_QUERY.cartId, input.cartId);
  appendFlowFlags(params, input.flags ?? {});
  return `${withBase("details/")}?${params.toString()}`;
}

export function confirmUrl(appointmentId: string, flags: BookingFlowFlags = {}): string {
  const params = new URLSearchParams({ appointment: appointmentId });
  appendFlowFlags(params, flags);
  return `${withBase("confirm/")}?${params.toString()}`;
}

/** Rebook same services + stylist — jumps to datetime when both are known. */
export function rebookUrl(
  serviceIds: string[],
  stylistSlug: string,
  flags: BookingFlowFlags = {},
): string {
  if (serviceIds.length > 0 && stylistSlug) {
    return datetimeUrl(serviceIds, stylistSlug, flags);
  }

  const params = new URLSearchParams();
  if (stylistSlug) params.set(BOOKING_QUERY.stylist, stylistSlug);
  const services = servicesQueryValue(serviceIds);
  if (services) params.set(BOOKING_QUERY.services, services);
  appendFlowFlags(params, flags);
  return `${withBase()}?${params.toString()}`;
}

/** API paths (respect /book base). */
export const bookingApi = {
  cart: withBase("api/booking/cart"),
  clientLookup: withBase("api/booking/clients/lookup.json"),
  setupIntent: withBase("api/booking/setup-intent"),
  appointments: withBase("api/booking/appointments"),
  availabilityDates: withBase("api/availability/dates.json"),
  availabilitySlots: withBase("api/availability/slots.json"),
  waitlist: withBase("api/booking/waitlist.json"),
} as const;
