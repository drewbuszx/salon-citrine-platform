/**
 * Minimal smoke test: load server-env + send a Resend test email.
 * Usage: node --import tsx scripts/test-booking-email.mjs [to@email.com]
 */
import { sendBookingConfirmationEmail } from "../src/lib/notifications/booking-confirmation.ts";
import { getServerEnv } from "../src/lib/server-env.ts";

const to = process.argv[2] ?? "delivered@resend.dev";

const key = getServerEnv("RESEND_API_KEY");
const from = getServerEnv("RESEND_FROM_EMAIL");
console.log("RESEND_API_KEY present:", Boolean(key), key ? `${key.slice(0, 6)}...` : "");
console.log("RESEND_FROM_EMAIL:", from ?? "(missing — will use BUSINESS.bookingEmail)");

const startsAt = new Date();
startsAt.setDate(startsAt.getDate() + 3);
startsAt.setHours(14, 0, 0, 0);

try {
  await sendBookingConfirmationEmail({
    clientFirstName: "Test",
    clientLastName: "Client",
    clientEmail: to,
    clientPhone: "3175551234",
    stylistName: "Test Stylist",
    startsAt: startsAt.toISOString(),
    services: [{ name: "Haircut" }],
    smsOptIn: false,
  });
  console.log("OK: sendBookingConfirmationEmail completed");
} catch (err) {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
}
