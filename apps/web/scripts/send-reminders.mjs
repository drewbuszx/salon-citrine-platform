/**
 * Trigger the 48h / 24h appointment reminder job locally.
 *
 * Usage:
 *   node scripts/send-reminders.mjs [--dry-run] [--hours=48] [--kind=48h|24h]
 *
 * Env (repo root .env):
 *   CRON_SECRET          — not required for this script (calls job directly)
 *   REMINDER_DRY_RUN=true — skip sends unless --dry-run=false
 *   REMINDER_DEV_HOURS=48 — treat "48h" window as N hours from now (dev testing)
 *
 * Cron endpoint (production / dev server running):
 *   curl -X POST http://localhost:4321/book/api/cron/send-reminders \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"dryRun":true}'
 */
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sendAppointmentReminders } from "../src/lib/notifications/appointment-reminders.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(__dirname, "../../..");
const mode = process.env.NODE_ENV ?? "development";
const env = loadEnv(mode, platformRoot, "");

for (const [key, value] of Object.entries(env)) {
  if (value && (process.env[key] === undefined || process.env[key] === "")) {
    process.env[key] = value;
  }
}

const args = process.argv.slice(2);
const dryRun =
  args.includes("--dry-run") ||
  (!args.includes("--no-dry-run") &&
    (process.env.REMINDER_DRY_RUN === "true" || process.env.REMINDER_DRY_RUN === "1"));

const hoursArg = args.find((a) => a.startsWith("--hours="));
const devHoursOverride = hoursArg ? Number(hoursArg.split("=")[1]) : undefined;

const kindArg = args.find((a) => a.startsWith("--kind="));
const kindValue = kindArg?.split("=")[1];
const kinds =
  kindValue === "48h" || kindValue === "24h" ? [kindValue] : undefined;

console.log("Env loaded from:", platformRoot);
console.log("Options:", { dryRun, devHoursOverride: devHoursOverride ?? null, kinds: kinds ?? ["48h", "24h"] });

const result = await sendAppointmentReminders({
  dryRun,
  devHoursOverride: Number.isFinite(devHoursOverride) ? devHoursOverride : undefined,
  kinds,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.errors.length > 0 ? 1 : 0);
