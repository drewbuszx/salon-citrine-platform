/** Salon shift session — 10 hours without remember-me. */
export const SESSION_MAX_AGE = 60 * 60 * 10;

/** Remember-me — 14 days on trusted salon devices. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 14;

/** Lock shift sessions after inactivity (shared workstations). */
export const IDLE_LOCK_MS = 30 * 60 * 1000;

export const SESSION_MODE_COOKIE = "sc_team_session_mode";

export type SessionMode = "shift" | "remember";

export function sessionModeFromRemember(remember: boolean): SessionMode {
  return remember ? "remember" : "shift";
}
