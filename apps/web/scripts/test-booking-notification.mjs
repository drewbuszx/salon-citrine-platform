/**
 * Smoke test for booking notification env + Resend/Twilio APIs.
 * Usage:
 *   node scripts/test-booking-notification.mjs [recipient@email.com]
 *   node scripts/test-booking-notification.mjs --health
 *
 * Dev Resend: from must be onboarding@resend.dev; recipient must be your Resend account email
 * until the salon domain is verified.
 */
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "../../..");
const mode = process.env.NODE_ENV ?? "development";
const env = loadEnv(mode, platformRoot, "");

for (const [key, value] of Object.entries(env)) {
  if (value && (process.env[key] === undefined || process.env[key] === "")) {
    process.env[key] = value;
  }
}

const resendKey = process.env.RESEND_API_KEY;
const healthOnly = process.argv.includes("--health");
const fromEmail =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  (mode !== "production" ? "onboarding@resend.dev" : "bookings@saloncitrineindy.com");
const toEmail = process.argv.find((a) => a.includes("@")) ?? "delivered@resend.dev";

console.log("Env loaded from:", platformRoot);
console.log("RESEND_API_KEY present:", Boolean(resendKey), resendKey ? `${resendKey.slice(0, 6)}...` : "");
console.log("RESEND_FROM_EMAIL:", fromEmail);
console.log("Test recipient:", toEmail);

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();

console.log("Notification health:");
console.log("  RESEND:", Boolean(resendKey));
console.log("  RESEND_FROM_EMAIL:", fromEmail);
console.log("  Twilio:", Boolean(twilioSid && twilioToken && twilioFrom));
console.log("  CRON_SECRET:", Boolean(cronSecret));
console.log("  REMINDER_DRY_RUN:", process.env.REMINDER_DRY_RUN ?? "(unset)");

if (healthOnly) {
  process.exit(resendKey ? 0 : 1);
}

let failed = false;

if (!resendKey) {
  console.error("FAIL: RESEND_API_KEY missing — check root .env");
  failed = true;
} else {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Salon Citrine <${fromEmail}>`,
      to: [toEmail],
      subject: "Booking notification smoke test",
      text: "If you received this, Resend is configured correctly for dev.",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("FAIL: Resend API", res.status, body);
    failed = true;
  } else {
    let id;
    try {
      id = JSON.parse(body).id;
    } catch {
      id = "(parse error)";
    }
    console.log("OK: Resend email sent, id:", id);
  }
}

console.log(
  "Twilio send:",
  twilioSid && twilioToken && twilioFrom ? "configured (skipped in smoke test)" : "not configured",
);

process.exit(failed ? 1 : 0);
