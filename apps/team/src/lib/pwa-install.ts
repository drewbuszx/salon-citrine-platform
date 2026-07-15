/** Canonical public URLs for the Team employee app PWA install flow. */

/** Primary production origin (custom domain). */
export const TEAM_CUSTOM_ORIGIN = "https://team.saloncitrineindy.com";

/** Fallback workers.dev origin (still live; keep for breakage / digests). */
export const TEAM_WORKERS_ORIGIN =
  "https://salon-citrine-team.dbuszx.workers.dev";

export const TEAM_INSTALL_PATH = "/install";

export function teamInstallAbsoluteUrl(
  origin: string = TEAM_CUSTOM_ORIGIN,
): string {
  return `${origin.replace(/\/$/, "")}/team${TEAM_INSTALL_PATH}`;
}

/** Canonical install URL for QR, one-pager, and printed cards. */
export const TEAM_INSTALL_URL = teamInstallAbsoluteUrl(TEAM_CUSTOM_ORIGIN);
