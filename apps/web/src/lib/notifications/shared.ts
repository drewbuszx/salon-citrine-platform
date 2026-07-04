import type { SupabaseClient } from "@supabase/supabase-js";
import { BUSINESS } from "@saloncitrine/shared";
import { getServerEnv } from "../server-env";

export function formatSalonAddress(): string {
  const { street, city, state, zip } = BUSINESS.address;
  return `${street}, ${city}, ${state} ${zip}`;
}

/** Normalize US phone numbers to E.164 for Twilio. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dev without a verified domain must use onboarding@resend.dev (Resend sandbox sender). */
export function getResendFromEmail(): string {
  const fromEnv = getServerEnv("RESEND_FROM_EMAIL")?.trim();
  if (fromEnv) return fromEnv;
  if (!import.meta.env?.PROD) return "onboarding@resend.dev";
  return BUSINESS.bookingEmail;
}

export function getAppOrigin(): string {
  return getServerEnv("APP_URL")?.trim() || `https://${BUSINESS.domain}`;
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  supabase?: SupabaseClient;
  metadata?: Record<string, unknown>;
};

export type SendEmailResult = {
  ok: boolean;
  resendId?: string;
  error?: string;
};

export async function sendResendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = getServerEnv("RESEND_API_KEY");
  const fromEmail = getResendFromEmail();

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${BUSINESS.name} <${fromEmail}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  const body = await response.text().catch(() => "");

  if (!response.ok) {
    const error = body || response.statusText;
    await logEmail(options.supabase, {
      recipient: options.to,
      template: options.template,
      resendId: null,
      status: "failed",
      metadata: { ...options.metadata, error },
    });
    return { ok: false, error };
  }

  let resendId: string | undefined;
  try {
    const parsed = JSON.parse(body) as { id?: string };
    resendId = parsed.id;
  } catch {
    // non-JSON success body
  }

  await logEmail(options.supabase, {
    recipient: options.to,
    template: options.template,
    resendId: resendId ?? null,
    status: "sent",
    metadata: options.metadata,
  });

  return { ok: true, resendId };
}

export type SendSmsOptions = {
  to: string;
  body: string;
  supabase?: SupabaseClient;
};

export type SendSmsResult = {
  ok: boolean;
  messageSid?: string;
  error?: string;
};

export async function sendTwilioSms(options: SendSmsOptions): Promise<SendSmsResult> {
  const accountSid = getServerEnv("TWILIO_ACCOUNT_SID");
  const authToken = getServerEnv("TWILIO_AUTH_TOKEN");
  const from = getServerEnv("TWILIO_PHONE_NUMBER")?.trim();

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio env vars not set" };
  }

  const to = toE164(options.to);
  if (!to) {
    return { ok: false, error: "invalid phone number" };
  }

  const params = new URLSearchParams({ To: to, Body: options.body });
  if (from.startsWith("MG")) {
    params.set("MessagingServiceSid", from);
  } else {
    params.set("From", from);
  }

  const auth = btoa(`${accountSid}:${authToken}`);
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const body = await response.text().catch(() => "");

  if (!response.ok) {
    const error = body || response.statusText;
    await logSms(options.supabase, {
      recipient: to,
      body: options.body,
      twilioSid: null,
      status: "failed",
    });
    return { ok: false, error };
  }

  let messageSid: string | undefined;
  try {
    const parsed = JSON.parse(body) as { sid?: string };
    messageSid = parsed.sid;
  } catch {
    // non-JSON success body
  }

  await logSms(options.supabase, {
    recipient: to,
    body: options.body,
    twilioSid: messageSid ?? null,
    status: "sent",
  });

  return { ok: true, messageSid };
}

type EmailLogRow = {
  recipient: string;
  template: string;
  resendId: string | null;
  status: string;
  metadata?: Record<string, unknown>;
};

async function logEmail(
  supabase: SupabaseClient | undefined,
  row: EmailLogRow,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("email_logs").insert({
    recipient: row.recipient,
    template: row.template,
    resend_id: row.resendId,
    status: row.status,
    metadata: row.metadata ?? null,
  });

  if (error) {
    console.error("notifications: email_logs insert failed", error);
  }
}

type SmsLogRow = {
  recipient: string;
  body: string;
  twilioSid: string | null;
  status: string;
};

async function logSms(supabase: SupabaseClient | undefined, row: SmsLogRow): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("sms_logs").insert({
    recipient: row.recipient,
    body: row.body,
    twilio_sid: row.twilioSid,
    status: row.status,
  });

  if (error) {
    console.error("notifications: sms_logs insert failed", error);
  }
}

export function isResendConfigured(): boolean {
  return Boolean(getServerEnv("RESEND_API_KEY"));
}

export function isTwilioConfigured(): boolean {
  return (
    Boolean(getServerEnv("TWILIO_ACCOUNT_SID")) &&
    Boolean(getServerEnv("TWILIO_AUTH_TOKEN")) &&
    Boolean(getServerEnv("TWILIO_PHONE_NUMBER")?.trim())
  );
}
