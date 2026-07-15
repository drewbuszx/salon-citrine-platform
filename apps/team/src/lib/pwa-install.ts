/** Canonical public URLs for the Team employee app PWA install flow. */

/** Resolves today. Prefer this for QR / install links while custom DNS is broken. */
export const TEAM_WORKERS_ORIGIN =
  "https://salon-citrine-team.dbuszx.workers.dev";

/** Intended custom domain (DNS currently fails to resolve). */
export const TEAM_CUSTOM_ORIGIN = "https://team.saloncitrineindy.com";

export const TEAM_INSTALL_PATH = "/install";

export function teamInstallAbsoluteUrl(
  origin: string = TEAM_WORKERS_ORIGIN,
): string {
  return `${origin.replace(/\/$/, "")}/team${TEAM_INSTALL_PATH}`;
}

export const TEAM_INSTALL_URL = teamInstallAbsoluteUrl(TEAM_WORKERS_ORIGIN);
