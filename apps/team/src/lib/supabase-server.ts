import {
  createServerClient,
  parseCookieHeader,
  type CookieMethodsServer,
} from "@supabase/ssr";
import type { AstroCookies } from "astro";

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY") {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to the repo root .env (see .env.example).`,
    );
  }
  return value;
}

export function createSupabaseServerClient(
  request: Request,
  cookies: AstroCookies,
) {
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return parseCookieHeader(request.headers.get("Cookie") ?? "");
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookies.set(name, value, options);
      });
    },
  };

  return createServerClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { cookies: cookieMethods },
  );
}

export function teamUrl(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!path) {
    return base || "/";
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
