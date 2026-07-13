import {
  createServerClient,
  parseCookieHeader,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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
  options?: { maxAge?: number },
) {
  const authorization = request.headers.get("Authorization");
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return parseCookieHeader(request.headers.get("Cookie") ?? "");
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options: cookieOpts }) => {
        cookies.set(name, value, {
          ...cookieOpts,
          ...(options?.maxAge != null ? { maxAge: options.maxAge } : {}),
        });
      });
    },
  };

  return createServerClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      cookies: cookieMethods,
      global: authorization
        ? { headers: { Authorization: authorization } }
        : undefined,
    },
  );
}

export function bearerTokenFromRequest(request: Request): string | null {
  const value = request.headers.get("Authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

export async function getRequestUser(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  request: Request,
) {
  const token = bearerTokenFromRequest(request);
  return token ? supabase.auth.getUser(token) : supabase.auth.getUser();
}

export function createSupabaseAdminClient() {
  const serviceRoleKey =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY ??
    workerEnv.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    typeof serviceRoleKey !== "string" ||
    serviceRoleKey.length < 20 ||
    /^(undefined|null|REPLACE|your[-_])/i.test(serviceRoleKey)
  ) {
    throw new Error("Missing required server-only SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(requireEnv("SUPABASE_URL"), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function teamUrl(path = "") {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!path) {
    return base || "/";
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute team-app URL for Supabase email redirects (must match Site URL / redirect allow list). */
export function teamAbsoluteUrl(path: string, request: Request) {
  const origin = new URL(request.url).origin;
  return `${origin}${teamUrl(path)}`;
}
