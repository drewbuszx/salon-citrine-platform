import {
  createServerClient,
  parseCookieHeader,
  type CookieMethodsServer,
} from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { env as workerEnv } from "cloudflare:workers";

type RequiredSupabaseEnv = "SUPABASE_URL" | "SUPABASE_ANON_KEY";

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidSupabaseAnonKey(value: string) {
  return value.length >= 20 && !/^(undefined|null|REPLACE|your[-_])/i.test(value);
}

function isValidEnvValue(name: RequiredSupabaseEnv, value: string) {
  return name === "SUPABASE_URL"
    ? isValidSupabaseUrl(value)
    : isValidSupabaseAnonKey(value);
}

function resolveEnv(name: RequiredSupabaseEnv) {
  const publicName =
    name === "SUPABASE_URL" ? "PUBLIC_SUPABASE_URL" : "PUBLIC_SUPABASE_ANON_KEY";

  const candidates = [
    import.meta.env[name],
    workerEnv[name],
    process.env[name],
    import.meta.env[publicName],
    workerEnv[publicName],
    process.env[publicName],
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.length === 0) {
      continue;
    }
    if (isValidEnvValue(name, candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function requireEnv(name: RequiredSupabaseEnv) {
  const value = resolveEnv(name);
  if (!value) {
    throw new Error(
      `Missing required runtime configuration for ${name}. Set it in Worker runtime bindings or environment variables.`,
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
