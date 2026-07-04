/**
 * Smoke test for booking notification env + Resend/Twilio APIs.
 * Usage: node scripts/test-booking-notification.mjs [recipient@email.com]
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
const fromEmail =
  process.env.RESEND_FROM_EMAIL?.trim() ||
  (mode !== "production" ? "onboarding@resend.dev" : "bookings@saloncitrineindy.com");
const toEmail = process.argv[2] ?? "delivered@resend.dev";

console.log("Env loaded from:", platformRoot);
console.log("RESEND_API_KEY present:", Boolean(resendKey), resendKey ? `${resendKey.slice(0, 6)}...` : "");
console.log("RESEND_FROM_EMAIL:", fromEmail);
console.log("Test recipient:", toEmail);

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

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_PHONE_NUMBER?.trim();

console.log(
  "Twilio configured:",
  Boolean(twilioSid && twilioToken && twilioFrom),
  twilioSid ? `${twilioSid.slice(0, 6)}...` : "",
);

if (twilioSid && twilioToken && twilioFrom) {
  console.log("(Twilio send skipped in smoke test — verify credentials in Twilio console after a real booking with SMS opt-in)");
}

process.exit(failed ? 1 : 0);
