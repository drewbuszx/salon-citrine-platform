import {
  calculateRequiredDepositCents,
  CART_RESERVATION_MINUTES,
  type BookingCart,
  type BookingCartItem,
} from "@saloncitrine/shared";
import { fetchActiveBookingPolicy } from "./booking-policy";
import { createSupabaseServiceClient } from "./supabase-server";

const DEFAULT_LOCATION_SLUG = "salon-citrine-indy";

type CartRow = {
  id: string;
  session_token: string;
  location_id: string;
  staff_id: string | null;
  status: BookingCart["status"];
  starts_at: string | null;
  ends_at: string | null;
  expires_at: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_message: string | null;
  referral_source: string | null;
};

type CartItemRow = {
  id: string;
  service_id: string;
  staff_id: string | null;
  sort_order: number;
  price_cents: number | null;
  duration_minutes: number;
  is_addon: boolean;
  option_ids: string[] | null;
  services: { name: string } | { name: string }[] | null;
};

export async function getDefaultLocationId(): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id")
    .eq("slug", DEFAULT_LOCATION_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error("Default location is not configured");
  }
  return data.id;
}

function mapCartItem(row: CartItemRow): BookingCartItem {
  const raw = row.services;
  const service = Array.isArray(raw) ? raw[0] : raw;
  return {
    id: row.id,
    serviceId: row.service_id,
    staffId: row.staff_id,
    name: service?.name ?? "Service",
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    isAddon: row.is_addon,
    sortOrder: row.sort_order,
    optionIds: row.option_ids ?? [],
  };
}

async function buildCartSummary(
  items: BookingCartItem[],
): Promise<BookingCart["summary"]> {
  const subtotalCents = items.reduce(
    (sum, item) => sum + (item.priceCents ?? 0),
    0,
  );
  const policy = await fetchActiveBookingPolicy();
  return {
    lineCount: items.length,
    totalDurationMinutes: items.reduce(
      (sum, item) => sum + item.durationMinutes,
      0,
    ),
    subtotalCents,
    depositRequiredCents: calculateRequiredDepositCents(policy, subtotalCents),
  };
}

function mapCart(
  row: CartRow,
  items: BookingCartItem[],
  summary: BookingCart["summary"],
): BookingCart {
  return {
    id: row.id,
    sessionToken: row.session_token,
    locationId: row.location_id,
    staffId: row.staff_id,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    expiresAt: row.expires_at,
    clientInformation: {
      email: row.client_email,
      phoneNumber: row.client_phone,
      firstName: row.client_first_name,
      lastName: row.client_last_name,
    },
    clientMessage: row.client_message,
    referralSource: row.referral_source,
    selectedItems: items,
    summary,
    errors: [],
  };
}

export async function loadBookingCart(cartId: string): Promise<BookingCart | null> {
  const supabase = createSupabaseServiceClient();
  const { data: cart, error } = await supabase
    .from("booking_carts")
    .select("*")
    .eq("id", cartId)
    .maybeSingle();

  if (error) throw error;
  if (!cart) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from("booking_cart_items")
    .select("*, services(name)")
    .eq("cart_id", cartId)
    .order("sort_order");

  if (itemsError) throw itemsError;

  const items = (itemRows ?? []).map((row) => mapCartItem(row as CartItemRow));
  const summary = await buildCartSummary(items);
  return mapCart(cart as CartRow, items, summary);
}

export async function createBookingCart(input: {
  staffId: string;
  serviceIds: string[];
  sessionToken?: string;
}): Promise<BookingCart> {
  const supabase = createSupabaseServiceClient();
  const locationId = await getDefaultLocationId();

  const { data: staffServices, error: staffServicesError } = await supabase
    .from("staff_services")
    .select("service_id, services(id, name, duration_minutes, base_price_cents, is_addon)")
    .eq("staff_id", input.staffId)
    .in("service_id", input.serviceIds);

  if (staffServicesError) throw staffServicesError;
  if ((staffServices ?? []).length !== input.serviceIds.length) {
    throw new Error("One or more services are not offered by this provider");
  }

  const insertPayload: Record<string, unknown> = {
    location_id: locationId,
    staff_id: input.staffId,
    status: "open",
  };
  if (input.sessionToken) {
    insertPayload.session_token = input.sessionToken;
  }

  const { data: cart, error: cartError } = await supabase
    .from("booking_carts")
    .insert(insertPayload)
    .select("*")
    .single();

  if (cartError || !cart) {
    throw cartError ?? new Error("Failed to create cart");
  }

  const itemRows = input.serviceIds.map((serviceId, index) => {
    const row = staffServices!.find((item) => item.service_id === serviceId);
    const raw = row?.services as
      | { duration_minutes: number; base_price_cents: number | null; is_addon: boolean }
      | Array<{ duration_minutes: number; base_price_cents: number | null; is_addon: boolean }>
      | null;
    const svc = Array.isArray(raw) ? raw[0] : raw;
    return {
      cart_id: cart.id,
      service_id: serviceId,
      staff_id: input.staffId,
      sort_order: index,
      price_cents: svc?.base_price_cents ?? null,
      duration_minutes: svc?.duration_minutes ?? 60,
      is_addon: svc?.is_addon ?? false,
    };
  });

  const { error: itemsError } = await supabase.from("booking_cart_items").insert(itemRows);
  if (itemsError) throw itemsError;

  const loaded = await loadBookingCart(cart.id);
  if (!loaded) throw new Error("Failed to load created cart");
  return loaded;
}

export async function reserveBookingCart(input: {
  cartId: string;
  startsAt: string;
  endsAt: string;
}): Promise<BookingCart> {
  const supabase = createSupabaseServiceClient();
  const expiresAt = new Date(Date.now() + CART_RESERVATION_MINUTES * 60_000).toISOString();

  const { error } = await supabase
    .from("booking_carts")
    .update({
      status: "reserved",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      expires_at: expiresAt,
    })
    .eq("id", input.cartId)
    .in("status", ["open", "reserved"]);

  if (error) throw error;

  const loaded = await loadBookingCart(input.cartId);
  if (!loaded) throw new Error("Cart not found after reservation");
  return loaded;
}

export async function updateBookingCartClient(input: {
  cartId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  clientMessage?: string;
  referralSource?: string;
}): Promise<BookingCart> {
  const supabase = createSupabaseServiceClient();
  const updates: Record<string, string | null> = {};

  if (input.email !== undefined) updates.client_email = input.email.trim().toLowerCase() || null;
  if (input.phone !== undefined) updates.client_phone = input.phone.trim() || null;
  if (input.firstName !== undefined) updates.client_first_name = input.firstName.trim() || null;
  if (input.lastName !== undefined) updates.client_last_name = input.lastName.trim() || null;
  if (input.clientMessage !== undefined) updates.client_message = input.clientMessage.trim() || null;
  if (input.referralSource !== undefined) updates.referral_source = input.referralSource.trim() || null;

  if (Object.keys(updates).length === 0) {
    const loaded = await loadBookingCart(input.cartId);
    if (!loaded) throw new Error("Cart not found");
    return loaded;
  }

  const { error } = await supabase
    .from("booking_carts")
    .update(updates)
    .eq("id", input.cartId);

  if (error) throw error;

  const loaded = await loadBookingCart(input.cartId);
  if (!loaded) throw new Error("Cart not found");
  return loaded;
}

export async function completeBookingCart(cartId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("booking_carts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      expires_at: null,
    })
    .eq("id", cartId);

  if (error) throw error;
}

export async function validateReservedCart(input: {
  cartId: string;
  staffId: string;
  startsAt: string;
}): Promise<boolean> {
  const cart = await loadBookingCart(input.cartId);
  if (!cart) return false;
  if (cart.status !== "reserved") return false;
  if (cart.staffId !== input.staffId) return false;
  if (!cart.startsAt || cart.startsAt !== input.startsAt) return false;
  if (!cart.expiresAt) return false;
  return new Date(cart.expiresAt).getTime() > Date.now();
}
