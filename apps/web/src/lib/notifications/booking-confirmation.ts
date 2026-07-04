import { BUSINESS } from "@saloncitrine/shared";
import { formatConfirmationWhen } from "../appointment-confirmation";
import { getServerEnv } from "../server-env";

export type BookingConfirmationPayload = {
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  stylistName: string;
  startsAt: string;
  services: Array<{ name: string }>;
  smsOptIn: boolean;
};

function formatSalonAddress(): string {
  const { street, city, state, zip } = BUSINESS.address;
  return `${street}, ${city}, ${state} ${zip}`;
}

/** Normalize US phone numbers to E.164 for Twilio. */
function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

function buildEmailSubject(payload: BookingConfirmationPayload): string {
  return `Your appointment at ${BUSINESS.name} is confirmed`;
}

function buildEmailText(payload: BookingConfirmationPayload): string {
  const clientName = `${payload.clientFirstName} ${payload.clientLastName}`.trim();
  const when = formatConfirmationWhen(payload.startsAt);
  const servicesList = payload.services.map((s) => s.name).join(", ");

  return [
    `Hi ${payload.clientFirstName},`,
    "",
    `Your appointment at ${BUSINESS.name} is confirmed.`,
    "",
    `When: ${when}`,
    `Stylist: ${payload.stylistName}`,
    `Services: ${servicesList}`,
    "",
    BUSINESS.name,
    formatSalonAddress(),
    BUSINESS.phone,
    "",
    "Need to reschedule? Contact us at least 48 hours before your appointment.",
  ].join("\n");
}

function buildEmailHtml(payload: BookingConfirmationPayload): string {
  const when = formatConfirmationWhen(payload.startsAt);
  const servicesList = payload.services.map((s) => s.name).join(", ");
  const address = formatSalonAddress();

  return `<!DOCTYPE html>
<html lang="en">
<body style="font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p>Hi ${escapeHtml(payload.clientFirstName)},</p>
  <p>Your appointment at <strong>${escapeHtml(BUSINESS.name)}</strong> is confirmed.</p>
  <table style="border-collapse: collapse; margin: 24px 0;">
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">When</td><td><strong>${escapeHtml(when)}</strong></td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Stylist</td><td>${escapeHtml(payload.stylistName)}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">Services</td><td>${escapeHtml(servicesList)}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">Location</td><td>${escapeHtml(BUSINESS.name)}<br>${escapeHtml(address)}</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">Questions? Call us at ${escapeHtml(BUSINESS.phone)}.</p>
  <p style="color: #666; font-size: 14px;">Need to reschedule? Contact us at least 48 hours before your appointment.</p>
</body>
</html>`;
}

function buildSmsBody(payload: BookingConfirmationPayload): string {
  const when = formatConfirmationWhen(payload.startsAt);
  return `${BUSINESS.name}: You're booked with ${payload.stylistName} on ${when}. ${formatSalonAddress()}. Reply STOP to opt out.`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Dev without a verified domain must use onboarding@resend.dev (Resend sandbox sender). */
function getResendFromEmail(): string {
  const fromEnv = getServerEnv("RESEND_FROM_EMAIL")?.trim();
  if (fromEnv) return fromEnv;
  if (!import.meta.env?.PROD) return "onboarding@resend.dev";
  return BUSINESS.bookingEmail;
}

export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationPayload,
): Promise<void> {
  const apiKey = getServerEnv("RESEND_API_KEY");
  const fromEmail = getResendFromEmail();

  if (!apiKey) {
    console.log(
      "booking-confirmation: email skipped — RESEND_API_KEY not set (check process.env / .env)",
    );
    return;
  }

  if (!payload.clientEmail) {
    console.log("booking-confirmation: email skipped — no client email");
    return;
  }

  console.log("booking-confirmation: sending email", {
    to: payload.clientEmail,
    from: fromEmail,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${BUSINESS.name} <${fromEmail}>`,
      to: [payload.clientEmail],
      subject: buildEmailSubject(payload),
      html: buildEmailHtml(payload),
      text: buildEmailText(payload),
    }),
  });

  const body = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("booking-confirmation: email failed:", body || response.statusText);
    return;
  }

  let resendId: string | undefined;
  try {
    const parsed = JSON.parse(body) as { id?: string };
    resendId = parsed.id;
  } catch {
    // non-JSON success body
  }

  console.log("booking-confirmation: email sent", {
    to: payload.clientEmail,
    id: resendId ?? "(no id in response)",
  });
}

export async function sendBookingConfirmationSms(
  payload: BookingConfirmationPayload,
): Promise<void> {
  if (!payload.smsOptIn) {
    console.log("booking-confirmation: SMS skipped — client did not opt in");
    return;
  }

  const accountSid = getServerEnv("TWILIO_ACCOUNT_SID");
  const authToken = getServerEnv("TWILIO_AUTH_TOKEN");
  const from = getServerEnv("TWILIO_PHONE_NUMBER")?.trim();

  if (!accountSid || !authToken || !from) {
    console.log(
      "booking-confirmation: SMS skipped — Twilio env vars not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)",
    );
    return;
  }

  const to = toE164(payload.clientPhone);
  if (!to) {
    console.log("booking-confirmation: SMS skipped — invalid client phone");
    return;
  }

  console.log("booking-confirmation: sending SMS", { to });

  // Production: register a Twilio 10DLC campaign before sending at scale.
  const params = new URLSearchParams({ To: to, Body: buildSmsBody(payload) });
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
    console.error("booking-confirmation: SMS failed:", body || response.statusText);
    return;
  }

  let messageSid: string | undefined;
  try {
    const parsed = JSON.parse(body) as { sid?: string };
    messageSid = parsed.sid;
  } catch {
    // non-JSON success body
  }

  console.log("booking-confirmation: SMS sent", {
    to,
    sid: messageSid ?? "(no sid in response)",
  });
}

/** Send confirmation email (always) and SMS (when opted in). Never throws. */
export async function sendBookingConfirmations(
  payload: BookingConfirmationPayload,
): Promise<void> {
  const hasResend = Boolean(getServerEnv("RESEND_API_KEY"));
  const hasTwilio =
    Boolean(getServerEnv("TWILIO_ACCOUNT_SID")) &&
    Boolean(getServerEnv("TWILIO_AUTH_TOKEN")) &&
    Boolean(getServerEnv("TWILIO_PHONE_NUMBER")?.trim());

  console.log(`booking-confirmation: Resend configured ${hasResend ? "yes" : "no"}`);
  console.log(`booking-confirmation: Twilio configured ${hasTwilio ? "yes" : "no"}`);

  if (!hasResend && !(hasTwilio && payload.smsOptIn)) {
    console.log(
      "booking-confirmation: notifications skipped — Resend and Twilio env not configured",
    );
    return;
  }

  console.log("booking-confirmation: dispatching notifications", {
    email: hasResend,
    sms: hasTwilio && payload.smsOptIn,
  });

  const tasks: Promise<void>[] = [sendBookingConfirmationEmail(payload)];
  if (payload.smsOptIn) {
    tasks.push(sendBookingConfirmationSms(payload));
  }

  await Promise.allSettled(tasks);
}
