/** User-facing login error codes (URL ?error=) — no sensitive account details. */
export type LoginErrorCode =
  | "invalid"
  | "unlinked"
  | "locked"
  | "disabled"
  | "expired"
  | "rate_limit"
  | "connection"
  | "mfa"
  | "config"
  | "reset_expired";

const MESSAGES: Record<LoginErrorCode, string> = {
  invalid:
    "Email or password is incorrect. Check your credentials and try again.",
  unlinked:
    "This account is not linked to a staff profile. Contact an owner to finish setup.",
  locked:
    "This account is temporarily locked after too many failed attempts. Wait a few minutes or contact support.",
  disabled:
    "This employee account is not active. Contact an owner if you believe this is a mistake.",
  expired:
    "Your password has expired. Use Forgot password to set a new one, or ask an owner for help.",
  rate_limit:
    "Too many sign-in attempts. Please wait a few minutes before trying again.",
  connection:
    "We could not reach the sign-in service. Check your connection and try again.",
  mfa:
    "Two-factor authentication is required for this account. Sign in on a device where 2FA is already set up, or contact support.",
  config:
    "Staff sign-in is temporarily unavailable. Try again shortly or contact support.",
  reset_expired:
    "Your reset link expired or you were signed out. Request a new reset link or sign in again.",
};

export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code as LoginErrorCode] ?? MESSAGES.invalid;
}

/** Map Supabase Auth errors to safe login error codes. */
export function mapSupabaseAuthError(message: string): LoginErrorCode {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "invalid";
  }
  if (msg.includes("too many") || msg.includes("rate limit")) {
    return "rate_limit";
  }
  if (msg.includes("banned") || msg.includes("disabled") || msg.includes("not allowed")) {
    return "disabled";
  }
  if (msg.includes("locked")) {
    return "locked";
  }
  if (msg.includes("mfa") || msg.includes("factor") || msg.includes("totp")) {
    return "mfa";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
    return "connection";
  }
  return "invalid";
}
