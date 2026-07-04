export const prerender = false;

import type { APIRoute } from "astro";
import "../../../lib/server-env";
import { jsonError, jsonOk } from "../../../lib/api-booking";
import { sendAppointmentReminders } from "../../../lib/notifications/appointment-reminders";
import { getServerEnv } from "../../../lib/server-env";

function isAuthorized(request: Request): boolean {
  const secret = getServerEnv("CRON_SECRET")?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  const cronHeader = request.headers.get("X-Cron-Secret");
  return cronHeader === secret;
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAuthorized(request)) {
    return jsonError("Unauthorized", 401);
  }

  let dryRun = getServerEnv("REMINDER_DRY_RUN") === "true" || getServerEnv("REMINDER_DRY_RUN") === "1";

  try {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "dryRun" in body) {
      dryRun = Boolean((body as { dryRun?: boolean }).dryRun);
    }
  } catch {
    // empty body is fine
  }

  try {
    const result = await sendAppointmentReminders({ dryRun });
    return jsonOk(result);
  } catch (error) {
    console.error("cron/send-reminders", error);
    const message = error instanceof Error ? error.message : "Reminder job failed";
    return jsonError(message, 500);
  }
};
