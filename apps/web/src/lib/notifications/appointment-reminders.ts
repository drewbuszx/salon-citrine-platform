import type { SupabaseClient } from "@supabase/supabase-js";
import { BUSINESS, TIMEZONE } from "@saloncitrine/shared";
import { formatConfirmationWhen } from "../appointment-confirmation";
import { createSupabaseServiceClient } from "../supabase-server";
import { getServerEnv } from "../server-env";
import {
  escapeHtml,
  formatSalonAddress,
  getAppOrigin,
  getResendFromEmail,
  isResendConfigured,
  isTwilioConfigured,
  sendResendEmail,
  sendTwilioSms,
  toE164,
} from "./shared";

export type ReminderKind = "48h" | "24h";

const REMINDER_CONFIG: Record<
  ReminderKind,
  { hours: number; toleranceHours: number; sentColumn: "reminder_48h_sent_at" | "reminder_24h_sent_at"; template: string }
> = {
  "48h": {
    hours: 48,
    toleranceHours: 1,
    sentColumn: "reminder_48h_sent_at",
    template: "appointment_reminder_48h",
  },
  "24h": {
    hours: 24,
    toleranceHours: 1,
    sentColumn: "reminder_24h_sent_at",
    template: "appointment_reminder_24h",
  },
};

type AppointmentRow = {
  id: string;
  starts_at: string;
  status: string;
  clients:
    | {
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        sms_opt_in: boolean;
        email_opt_in: boolean;
      }
    | Array<{
        first_name: string;
        last_name: string;
        email: string | null;
        phone: string | null;
        sms_opt_in: boolean;
        email_opt_in: boolean;
      }>
    | null;
  staff: { name: string } | Array<{ name: string }> | null;
  appointment_services: Array<{
    services: { name: string } | Array<{ name: string }> | null;
  }>;
};

export type ReminderAppointmentPayload = {
  appointmentId: string;
  clientFirstName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  stylistName: string;
  startsAt: string;
  services: Array<{ name: string }>;
};

export type ReminderSendResult = {
  appointmentId: string;
  kind: ReminderKind;
  email: "sent" | "skipped" | "failed" | "dry_run";
  sms: "sent" | "skipped" | "failed" | "dry_run";
  markedSent: boolean;
};

export type SendRemindersResult = {
  dryRun: boolean;
  processed: ReminderSendResult[];
  errors: string[];
};

function parseDevHoursOverride(): number | undefined {
  const raw = getServerEnv("REMINDER_DEV_HOURS")?.trim();
  if (!raw) return undefined;
  const hours = Number(raw);
  return Number.isFinite(hours) && hours > 0 ? hours : undefined;
}

/** Window for appointments starting ~N hours from now (America/Indiana/Indianapolis display only). */
export function getReminderWindow(
  kind: ReminderKind,
  now = new Date(),
  devHoursOverride?: number,
): { start: Date; end: Date } {
  const config = REMINDER_CONFIG[kind];
  const centerHours = devHoursOverride ?? config.hours;
  const tolerance = devHoursOverride !== undefined ? 0.5 : config.toleranceHours;

  return {
    start: new Date(now.getTime() + (centerHours - tolerance) * 3_600_000),
    end: new Date(now.getTime() + (centerHours + tolerance) * 3_600_000),
  };
}

function formatShortWhen(startsAtIso: string): string {
  const startsAt = new Date(startsAtIso);
  const date = startsAt.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = startsAt.toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

function buildReminderEmailSubject(kind: ReminderKind): string {
  const lead = kind === "48h" ? "in 2 days" : "tomorrow";
  return `Reminder: your ${BUSINESS.name} appointment is ${lead}`;
}

function buildReminderEmailText(payload: ReminderAppointmentPayload, kind: ReminderKind): string {
  const when = formatConfirmationWhen(payload.startsAt);
  const servicesList = payload.services.map((s) => s.name).join(", ");
  const lead = kind === "48h" ? "two days" : "tomorrow";
  const site = getAppOrigin();

  return [
    `Hi ${payload.clientFirstName},`,
    "",
    `This is a friendly reminder that your appointment at ${BUSINESS.name} is ${lead}.`,
    "",
    `When: ${when}`,
    `Stylist: ${payload.stylistName}`,
    `Services: ${servicesList}`,
    "",
    BUSINESS.name,
    formatSalonAddress(),
    BUSINESS.phone,
    "",
    `Need to reschedule or cancel? Contact us at least 48 hours before your appointment to avoid fees. Visit ${site} or call ${BUSINESS.phone}.`,
  ].join("\n");
}

function buildReminderEmailHtml(payload: ReminderAppointmentPayload, kind: ReminderKind): string {
  const when = formatConfirmationWhen(payload.startsAt);
  const servicesList = payload.services.map((s) => s.name).join(", ");
  const address = formatSalonAddress();
  const lead = kind === "48h" ? "in two days" : "tomorrow";
  const site = getAppOrigin();

  return `<!DOCTYPE html>
<html lang="en">
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hi ${escapeHtml(payload.clientFirstName)},</p>
  <p>Your appointment at <strong>${escapeHtml(BUSINESS.name)}</strong> is ${lead}.</p>
  <table style="border-collapse: collapse; margin: 24px 0;">
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">When</td><td><strong>${escapeHtml(when)}</strong></td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Stylist</td><td>${escapeHtml(payload.stylistName)}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">Services</td><td>${escapeHtml(servicesList)}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">Location</td><td>${escapeHtml(BUSINESS.name)}<br>${escapeHtml(address)}</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">Questions? Call ${escapeHtml(BUSINESS.phone)}.</p>
  <p style="color: #666; font-size: 14px;">Reschedule or cancel at least 48 hours ahead to avoid fees. <a href="${escapeHtml(site)}">${escapeHtml(site)}</a></p>
</body>
</html>`;
}

function buildReminderSmsBody(payload: ReminderAppointmentPayload, kind: ReminderKind): string {
  const when = formatShortWhen(payload.startsAt);
  const lead = kind === "48h" ? "2 days" : "24 hrs";
  // Keep under 160 chars when possible
  return `${BUSINESS.name}: Appt in ${lead} w/ ${payload.stylistName}, ${when}. ${BUSINESS.address.street}. Call ${BUSINESS.phone} to reschedule. STOP to opt out.`;
}

function rowToPayload(row: AppointmentRow): ReminderAppointmentPayload | null {
  const clientRaw = row.clients;
  const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
  const staffRaw = row.staff;
  const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw;

  if (!client || !staff) return null;

  const services = (row.appointment_services ?? [])
    .map((item) => {
      const raw = item.services;
      const svc = Array.isArray(raw) ? raw[0] : raw;
      return svc ? { name: svc.name } : null;
    })
    .filter((svc): svc is { name: string } => svc !== null);

  return {
    appointmentId: row.id,
    clientFirstName: client.first_name,
    clientEmail: client.email,
    clientPhone: client.phone,
    emailOptIn: client.email_opt_in,
    smsOptIn: client.sms_opt_in,
    stylistName: staff.name,
    startsAt: row.starts_at,
    services,
  };
}

async function fetchDueAppointments(
  supabase: SupabaseClient,
  kind: ReminderKind,
  window: { start: Date; end: Date },
): Promise<AppointmentRow[]> {
  const { sentColumn } = REMINDER_CONFIG[kind];

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      starts_at,
      status,
      clients(first_name, last_name, email, phone, sms_opt_in, email_opt_in),
      staff(name),
      appointment_services(services(name))
    `,
    )
    .in("status", ["confirmed", "pending"])
    .is(sentColumn, null)
    .gte("starts_at", window.start.toISOString())
    .lt("starts_at", window.end.toISOString());

  if (error) {
    throw new Error(`appointments query failed (${kind}): ${error.message}`);
  }

  return (data ?? []) as AppointmentRow[];
}

async function sendReminderForAppointment(
  supabase: SupabaseClient,
  payload: ReminderAppointmentPayload,
  kind: ReminderKind,
  dryRun: boolean,
): Promise<ReminderSendResult> {
  const { sentColumn, template } = REMINDER_CONFIG[kind];
  const shouldEmail = Boolean(payload.clientEmail?.trim()) && payload.emailOptIn !== false;
  const shouldSms =
    payload.smsOptIn && Boolean(payload.clientPhone?.trim()) && Boolean(toE164(payload.clientPhone ?? ""));

  const result: ReminderSendResult = {
    appointmentId: payload.appointmentId,
    kind,
    email: shouldEmail ? "failed" : "skipped",
    sms: shouldSms ? "failed" : "skipped",
    markedSent: false,
  };

  if (dryRun) {
    console.log("appointment-reminders: dry run", {
      kind,
      appointmentId: payload.appointmentId,
      shouldEmail,
      shouldSms,
      startsAt: payload.startsAt,
      to: payload.clientEmail,
      smsTo: payload.clientPhone,
    });
    result.email = shouldEmail ? "dry_run" : "skipped";
    result.sms = shouldSms ? "dry_run" : "skipped";
    result.markedSent = false;
    return result;
  }

  let emailOk = !shouldEmail;
  let smsOk = !shouldSms;

  if (shouldEmail && isResendConfigured()) {
    const emailResult = await sendResendEmail({
      to: payload.clientEmail!.trim(),
      subject: buildReminderEmailSubject(kind),
      html: buildReminderEmailHtml(payload, kind),
      text: buildReminderEmailText(payload, kind),
      template,
      supabase,
      metadata: { appointmentId: payload.appointmentId, kind },
    });
    emailOk = emailResult.ok;
    result.email = emailResult.ok ? "sent" : "failed";
    if (!emailResult.ok) {
      console.error("appointment-reminders: email failed", payload.appointmentId, emailResult.error);
    }
  } else if (shouldEmail) {
    result.email = "failed";
    console.error("appointment-reminders: email skipped — Resend not configured");
  }

  if (shouldSms && isTwilioConfigured()) {
    const smsResult = await sendTwilioSms({
      to: payload.clientPhone!.trim(),
      body: buildReminderSmsBody(payload, kind),
      supabase,
    });
    smsOk = smsResult.ok;
    result.sms = smsResult.ok ? "sent" : "failed";
    if (!smsResult.ok) {
      console.error("appointment-reminders: SMS failed", payload.appointmentId, smsResult.error);
    }
  } else if (shouldSms) {
    result.sms = "failed";
    console.error("appointment-reminders: SMS skipped — Twilio not configured");
  }

  const nothingToSend = !shouldEmail && !shouldSms;
  const allSucceeded = (emailOk && smsOk) || nothingToSend;

  if (allSucceeded) {
    const { error } = await supabase
      .from("appointments")
      .update({ [sentColumn]: new Date().toISOString() })
      .eq("id", payload.appointmentId);

    if (error) {
      console.error("appointment-reminders: failed to mark sent", payload.appointmentId, error);
    } else {
      result.markedSent = true;
    }
  }

  return result;
}

export async function sendAppointmentReminders(options?: {
  dryRun?: boolean;
  kinds?: ReminderKind[];
  devHoursOverride?: number;
  supabase?: SupabaseClient;
}): Promise<SendRemindersResult> {
  const dryRun =
    options?.dryRun ??
    (getServerEnv("REMINDER_DRY_RUN") === "true" || getServerEnv("REMINDER_DRY_RUN") === "1");
  const kinds = options?.kinds ?? (["48h", "24h"] as ReminderKind[]);
  const devHoursOverride = options?.devHoursOverride ?? parseDevHoursOverride();
  const supabase = options?.supabase ?? createSupabaseServiceClient();
  const now = new Date();
  const processed: ReminderSendResult[] = [];
  const errors: string[] = [];

  console.log("appointment-reminders: starting", {
    dryRun,
    kinds,
    devHoursOverride: devHoursOverride ?? null,
    resend: isResendConfigured(),
    twilio: isTwilioConfigured(),
    fromEmail: getResendFromEmail(),
  });

  for (const kind of kinds) {
    const window = getReminderWindow(kind, now, devHoursOverride);
    console.log(`appointment-reminders: ${kind} window`, {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    });

    try {
      const rows = await fetchDueAppointments(supabase, kind, window);
      console.log(`appointment-reminders: ${kind} found ${rows.length} appointment(s)`);

      for (const row of rows) {
        const payload = rowToPayload(row);
        if (!payload) {
          errors.push(`appointment ${row.id}: missing client or staff`);
          continue;
        }

        const sendResult = await sendReminderForAppointment(supabase, payload, kind, dryRun);
        processed.push(sendResult);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${kind}: ${message}`);
      console.error(`appointment-reminders: ${kind} sweep failed`, error);
    }
  }

  return { dryRun, processed, errors };
}
