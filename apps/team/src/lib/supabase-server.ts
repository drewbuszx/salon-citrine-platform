import {
  createServerClient,
  parseCookieHeader,
  type CookieMethodsServer,
} from "@supabase/ssr";
import type { AstroCookies } from "astro";
import { env as workerEnv } from "cloudflare:workers";

type RequiredSupabaseEnv = "SUPABASE_URL" | "SUPABASE_ANON_KEY";

function resolveEnv(name: RequiredSupabaseEnv) {
  const fromImportMeta = import.meta.env[name];
  if (fromImportMeta) {
    return fromImportMeta;
  }

  const fromWorkerBinding = workerEnv[name];
  if (fromWorkerBinding) {
    return fromWorkerBinding;
  }

  const fromProcess = process.env[name];
  if (fromProcess) {
    return fromProcess;
  }

  const publicName =
    name === "SUPABASE_URL" ? "PUBLIC_SUPABASE_URL" : "PUBLIC_SUPABASE_ANON_KEY";
  return (
    import.meta.env[publicName] ??
    workerEnv[publicName] ??
    process.env[publicName]
  );
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
