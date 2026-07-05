import { BUSINESS } from "@saloncitrine/shared";
import { formatConfirmationWhen } from "../appointment-confirmation";
import {
  escapeHtml,
  formatSalonAddress,
  getResendFromEmail,
  isResendConfigured,
  isTwilioConfigured,
  sendResendEmail,
  sendTwilioSms,
  toE164,
} from "./shared";

export type BookingConfirmationPayload = {
  appointmentId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone: string;
  stylistName: string;
  startsAt: string;
  services: Array<{ name: string }>;
  smsOptIn: boolean;
  policySummary: string;
  depositChargedCents?: number;
};

function buildEmailSubject(): string {
  return `Your appointment at ${BUSINESS.name} is confirmed`;
}

function buildEmailText(payload: BookingConfirmationPayload): string {
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
    `Confirmation: ${payload.appointmentId.slice(0, 8).toUpperCase()}`,
    "",
    BUSINESS.name,
    formatSalonAddress(),
    BUSINESS.phone,
    "",
    payload.policySummary,
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
    <tr><td style="padding: 4px 16px 4px 0; color: #666;">Confirmation</td><td>${escapeHtml(payload.appointmentId.slice(0, 8).toUpperCase())}</td></tr>
    <tr><td style="padding: 4px 16px 4px 0; color: #666; vertical-align: top;">Location</td><td>${escapeHtml(BUSINESS.name)}<br>${escapeHtml(address)}</td></tr>
  </table>
  <p style="color: #666; font-size: 14px;">Questions? Call us at ${escapeHtml(BUSINESS.phone)}.</p>
  <p style="color: #666; font-size: 14px;">${escapeHtml(payload.policySummary)}</p>
</body>
</html>`;
}

function buildSmsBody(payload: BookingConfirmationPayload): string {
  const when = formatConfirmationWhen(payload.startsAt);
  const policySnippet = payload.policySummary.split(".")[0]?.trim() ?? "";
  return `${BUSINESS.name}: Booked ${when} w/ ${payload.stylistName}. ${policySnippet}. Reply STOP to opt out.`;
}

export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationPayload,
): Promise<void> {
  if (!isResendConfigured()) {
    console.log(
      "booking-confirmation: email skipped — RESEND_API_KEY not set (check process.env / .env)",
    );
    return;
  }

  if (!payload.clientEmail) {
    console.log("booking-confirmation: email skipped — no client email");
    return;
  }

  const fromEmail = getResendFromEmail();
  console.log("booking-confirmation: sending email", {
    to: payload.clientEmail,
    from: fromEmail,
  });

  const result = await sendResendEmail({
    to: payload.clientEmail,
    subject: buildEmailSubject(),
    html: buildEmailHtml(payload),
    text: buildEmailText(payload),
    template: "booking_confirmation",
    metadata: { startsAt: payload.startsAt },
  });

  if (!result.ok) {
    console.error("booking-confirmation: email failed:", result.error);
    return;
  }

  console.log("booking-confirmation: email sent", {
    to: payload.clientEmail,
    id: result.resendId ?? "(no id in response)",
  });
}

export async function sendBookingConfirmationSms(
  payload: BookingConfirmationPayload,
): Promise<void> {
  if (!payload.smsOptIn) {
    console.log("booking-confirmation: SMS skipped — client did not opt in");
    return;
  }

  if (!isTwilioConfigured()) {
    console.log(
      "booking-confirmation: SMS skipped — Twilio env vars not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)",
    );
    return;
  }

  if (!toE164(payload.clientPhone)) {
    console.log("booking-confirmation: SMS skipped — invalid client phone");
    return;
  }

  console.log("booking-confirmation: sending SMS", { to: payload.clientPhone });

  const result = await sendTwilioSms({
    to: payload.clientPhone,
    body: buildSmsBody(payload),
  });

  if (!result.ok) {
    console.error("booking-confirmation: SMS failed:", result.error);
    return;
  }

  console.log("booking-confirmation: SMS sent", {
    to: payload.clientPhone,
    sid: result.messageSid ?? "(no sid in response)",
  });
}

/** Send confirmation email (always) and SMS (when opted in). Never throws. */
export async function sendBookingConfirmations(
  payload: BookingConfirmationPayload,
): Promise<void> {
  const hasResend = isResendConfigured();
  const hasTwilio = isTwilioConfigured();

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
