import { TIMEZONE } from "@saloncitrine/shared";
import { createSupabaseServiceClient } from "./supabase-server";
import { formatSlotLabel } from "./datetime-utils";

export type ConfirmationDetails = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  policySnapshot: Record<string, unknown>;
  depositRequiredCents: number;
  client: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    intakeNotes?: string | null;
    bookingPreferences?: string | null;
  };
  staff: {
    name: string;
    slug: string;
  };
  services: Array<{
    name: string;
    priceCents: number | null;
    durationMinutes: number;
  }>;
};

export async function fetchAppointmentConfirmation(
  appointmentId: string,
): Promise<ConfirmationDetails | null> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      starts_at,
      ends_at,
      status,
      policy_snapshot,
      deposit_required_cents,
      clients(first_name, last_name, email, phone),
      staff(name, slug),
      appointment_services(
        price_cents,
        services(name, duration_minutes, base_price_cents)
      )
    `,
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("fetchAppointmentConfirmation", error);
    return null;
  }

  if (!data) return null;

  const clientRaw = data.clients as
    | {
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
      }
    | Array<{
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
      }>
    | null;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;

  const staffRaw = data.staff as
    | { name: string; slug: string }
    | Array<{ name: string; slug: string }>
    | null;
  const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw;

  if (!client || !staff) return null;

  const serviceRows = (data.appointment_services ?? []) as Array<{
    price_cents: number | null;
    services:
      | { name: string; duration_minutes: number; base_price_cents: number | null }
      | Array<{ name: string; duration_minutes: number; base_price_cents: number | null }>
      | null;
  }>;

  const services = serviceRows
    .map((row) => {
      const raw = row.services;
      const svc = Array.isArray(raw) ? raw[0] : raw;
      if (!svc) return null;
      return {
        name: svc.name,
        priceCents: row.price_cents ?? svc.base_price_cents,
        durationMinutes: svc.duration_minutes,
      };
    })
    .filter((svc): svc is NonNullable<typeof svc> => svc !== null);

  return {
    id: data.id,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    status: data.status,
    policySnapshot: (data.policy_snapshot as Record<string, unknown> | null) ?? {},
    depositRequiredCents: data.deposit_required_cents ?? 0,
    client: {
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email,
      phone: client.phone,
    },
    staff: {
      name: staff.name,
      slug: staff.slug,
    },
    services,
  };
}

export function formatConfirmationWhen(startsAtIso: string): string {
  const startsAt = new Date(startsAtIso);
  const date = startsAt.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = formatSlotLabel(startsAt);
  return `${date} at ${time}`;
}
