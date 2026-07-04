export const prerender = false;

import type { APIRoute } from "astro";
import "../../../lib/server-env";
import { jsonOk } from "../../../lib/api-booking";
import { getResendFromEmail, isResendConfigured, isTwilioConfigured } from "../../../lib/notifications/shared";
import { getServerEnv } from "../../../lib/server-env";

export const GET: APIRoute = async () => {
  const resendConfigured = isResendConfigured();
  const twilioConfigured = isTwilioConfigured();
  const cronSecretConfigured = Boolean(getServerEnv("CRON_SECRET")?.trim());

  return jsonOk({
    resend: {
      configured: resendConfigured,
      fromEmail: resendConfigured ? getResendFromEmail() : null,
    },
    twilio: {
      configured: twilioConfigured,
      hasPhoneNumber: Boolean(getServerEnv("TWILIO_PHONE_NUMBER")?.trim()),
    },
    cron: {
      secretConfigured: cronSecretConfigured,
    },
    reminders: {
      dryRunDefault:
        getServerEnv("REMINDER_DRY_RUN") === "true" || getServerEnv("REMINDER_DRY_RUN") === "1",
      devHoursOverride: getServerEnv("REMINDER_DEV_HOURS") ?? null,
    },
  });
};
