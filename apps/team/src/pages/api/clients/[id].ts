import type { APIRoute } from "astro";
import { z } from "zod";
import {
  INTAKE_REFERRAL_SOURCES,
  PREFERRED_CONTACT_METHODS,
} from "@saloncitrine/shared";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import { formatTimeInSalon } from "../../../lib/calendar";

const patchClientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  intakeNotes: z.string().max(1200).nullable().optional(),
  bookingPreferences: z.string().max(600).nullable().optional(),
  staffNotes: z.string().max(4000).nullable().optional(),
  formulaNotes: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  smsOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  addressCity: z.string().max(100).nullable().optional(),
  addressState: z.string().max(2).nullable().optional(),
  addressZip: z.string().max(10).nullable().optional(),
  preferredContactMethod: z.enum(PREFERRED_CONTACT_METHODS).nullable().optional(),
  referralSources: z.array(z.enum(INTAKE_REFERRAL_SOURCES)).max(8).optional(),
});

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const clientId = String(context.params.id ?? "");
  if (!clientId) return jsonError("Client id required", 400);

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select(
      "id, first_name, last_name, phone, email, intake_notes, booking_preferences, staff_notes, formula_notes, tags, visit_count, last_visit_at, lifetime_value_cents, sms_opt_in, email_opt_in, created_at, birthday, address_line1, address_line2, address_city, address_state, address_zip, preferred_contact_method, referral_sources",
    )
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    console.error("client load failed", clientError);
    return jsonError("Failed to load client", 500);
  }
  if (!client) return jsonError("Client not found", 404);

  const [appointmentsResult, notesResult, ordersResult, referralsResult] =
    await Promise.all([
      auth.supabase
        .from("appointments")
        .select(
          `
          id,
          starts_at,
          ends_at,
          status,
          staff ( name ),
          appointment_services ( services ( name ), price_cents )
        `,
        )
        .eq("client_id", clientId)
        .order("starts_at", { ascending: false })
        .limit(30),
      auth.supabase
        .from("client_notes")
        .select("id, note_type, body, created_at, staff ( name )")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(40),
      auth.supabase
        .from("checkout_orders")
        .select("id, total_cents, completed_at, status")
        .eq("client_id", clientId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(10),
      auth.supabase
        .from("referrals")
        .select("id, referred_client_id, discount_applied, created_at")
        .eq("referrer_client_id", clientId),
    ]);

  if (appointmentsResult.error) {
    return jsonError("Failed to load appointments", 500);
  }
  if (notesResult.error) {
    return jsonError("Failed to load notes", 500);
  }

  const visitTimeline = (appointmentsResult.data ?? []).map((appt) => {
    const services =
      (appt.appointment_services as Array<{
        services: { name: string } | null;
        price_cents: number | null;
      }> | null) ?? [];
    const serviceNames = services
      .map((row) => row.services?.name)
      .filter(Boolean) as string[];
    const staffRaw = appt.staff as { name: string } | { name: string }[] | null;
    const staffName = Array.isArray(staffRaw) ? staffRaw[0]?.name : staffRaw?.name;

    return {
      id: appt.id,
      startsAt: appt.starts_at,
      endsAt: appt.ends_at,
      status: appt.status,
      staffName: staffName ?? "",
      serviceNames,
      timeLabel: formatTimeInSalon(appt.starts_at),
    };
  });

  const notes = (notesResult.data ?? []).map((row) => {
    const staffRaw = row.staff as { name: string } | { name: string }[] | null;
    return {
      id: row.id,
      noteType: row.note_type,
      body: row.body,
      createdAt: row.created_at,
      staffName: (Array.isArray(staffRaw) ? staffRaw[0]?.name : staffRaw?.name) ?? "",
    };
  });

  const pastServices: Array<{ date: string; serviceName: string }> = [];
  for (const visit of visitTimeline) {
    if (!["booked", "confirmed", "arrived", "completed"].includes(visit.status)) {
      continue;
    }
    for (const name of visit.serviceNames) {
      pastServices.push({ date: visit.startsAt, serviceName: name });
    }
  }

  const referralCount = referralsResult.data?.length ?? 0;
  const pendingReferralDiscount =
    referralsResult.data?.some((row) => !row.discount_applied) ?? false;

  return jsonOk({
    client: {
      id: client.id,
      firstName: client.first_name,
      lastName: client.last_name,
      fullName: `${client.first_name} ${client.last_name}`.trim(),
      phone: client.phone,
      email: client.email,
      intakeNotes: client.intake_notes,
      bookingPreferences: client.booking_preferences,
      staffNotes: client.staff_notes,
      formulaNotes: client.formula_notes,
      tags: client.tags ?? [],
      visitCount: client.visit_count ?? 0,
      lastVisitAt: client.last_visit_at,
      lifetimeValueCents: client.lifetime_value_cents ?? 0,
      smsOptIn: client.sms_opt_in,
      emailOptIn: client.email_opt_in,
      memberSince: client.created_at,
      birthday: client.birthday,
      addressLine1: client.address_line1,
      addressLine2: client.address_line2,
      addressCity: client.address_city,
      addressState: client.address_state,
      addressZip: client.address_zip,
      preferredContactMethod: client.preferred_contact_method,
      referralSources: client.referral_sources ?? [],
    },
    visitTimeline,
    notes,
    checkoutHistory: ordersResult.data ?? [],
    pastServices,
    referrals: {
      count: referralCount,
      pendingDiscount: pendingReferralDiscount,
    },
  });
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const clientId = String(context.params.id ?? "");
  if (!clientId) return jsonError("Client id required", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = patchClientSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.firstName !== undefined) updates.first_name = parsed.data.firstName.trim();
  if (parsed.data.lastName !== undefined) updates.last_name = parsed.data.lastName.trim();
  if (parsed.data.email !== undefined) {
    updates.email = parsed.data.email?.trim().toLowerCase() ?? null;
  }
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone?.trim() ?? null;
  if (parsed.data.intakeNotes !== undefined) {
    updates.intake_notes = parsed.data.intakeNotes?.trim() ?? null;
  }
  if (parsed.data.bookingPreferences !== undefined) {
    updates.booking_preferences = parsed.data.bookingPreferences?.trim() ?? null;
  }
  if (parsed.data.staffNotes !== undefined) {
    updates.staff_notes = parsed.data.staffNotes?.trim() ?? null;
  }
  if (parsed.data.formulaNotes !== undefined) {
    updates.formula_notes = parsed.data.formulaNotes?.trim() ?? null;
  }
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
  if (parsed.data.smsOptIn !== undefined) updates.sms_opt_in = parsed.data.smsOptIn;
  if (parsed.data.emailOptIn !== undefined) updates.email_opt_in = parsed.data.emailOptIn;
  if (parsed.data.birthday !== undefined) updates.birthday = parsed.data.birthday;
  if (parsed.data.addressLine1 !== undefined) {
    updates.address_line1 = parsed.data.addressLine1?.trim() ?? null;
  }
  if (parsed.data.addressLine2 !== undefined) {
    updates.address_line2 = parsed.data.addressLine2?.trim() ?? null;
  }
  if (parsed.data.addressCity !== undefined) {
    updates.address_city = parsed.data.addressCity?.trim() ?? null;
  }
  if (parsed.data.addressState !== undefined) {
    updates.address_state = parsed.data.addressState?.trim().toUpperCase() ?? null;
  }
  if (parsed.data.addressZip !== undefined) {
    updates.address_zip = parsed.data.addressZip?.trim() ?? null;
  }
  if (parsed.data.preferredContactMethod !== undefined) {
    updates.preferred_contact_method = parsed.data.preferredContactMethod;
  }
  if (parsed.data.referralSources !== undefined) {
    updates.referral_sources = parsed.data.referralSources;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  const { error } = await auth.supabase.from("clients").update(updates).eq("id", clientId);
  if (error) {
    console.error("client update failed", error);
    return jsonError("Failed to update client", 500);
  }

  return jsonOk();
};
