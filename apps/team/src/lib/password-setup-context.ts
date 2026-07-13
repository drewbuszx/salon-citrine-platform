import type { AstroCookies } from "astro";

// Marks a session that was established through a verified recovery or invite token
// exchange. Only this context may reach the reset-password form, so an ordinary
// authenticated session cannot change its password without the current one.
export const PASSWORD_SETUP_COOKIE = "sc_pw_setup";

const BASE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export function grantPasswordSetupContext(
  cookies: AstroCookies,
  flow: "invite" | "recovery",
) {
  cookies.set(PASSWORD_SETUP_COOKIE, flow, {
    ...BASE_OPTIONS,
    maxAge: 60 * 10,
  });
}

export function hasPasswordSetupContext(cookies: AstroCookies) {
  return cookies.has(PASSWORD_SETUP_COOKIE);
}

export function clearPasswordSetupContext(cookies: AstroCookies) {
  cookies.delete(PASSWORD_SETUP_COOKIE, { ...BASE_OPTIONS });
}
