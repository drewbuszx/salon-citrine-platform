import { defineMiddleware } from "astro:middleware";
import {
  isSalonManager,
  loadStaffProfile,
  mustChangePassword,
} from "./lib/auth";
import { disabledModuleForPath } from "./lib/modules";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "./lib/security-headers";
import {
  createSupabaseServerClient,
  getRequestUser,
  teamUrl,
} from "./lib/supabase-server";
import { hasPasswordSetupContext } from "./lib/password-setup-context";

const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/auth/confirm"]);
const RESET_PASSWORD_PATH = "/reset-password";
const CHANGE_PASSWORD_PATH = "/change-password";

function normalizePath(pathname: string, base: string) {
  const baseNormalized = base.endsWith("/") ? base.slice(0, -1) : base;
  if (baseNormalized && pathname.startsWith(baseNormalized)) {
    return pathname.slice(baseNormalized.length) || "/";
  }
  return pathname;
}

function isStaticAssetPath(routePath: string) {
  return (
    routePath.startsWith("/_astro/") ||
    routePath.startsWith("/fonts/") ||
    routePath.startsWith("/images/") ||
    routePath.endsWith(".css") ||
    routePath.endsWith(".js") ||
    routePath.endsWith(".woff2") ||
    routePath.endsWith(".ico")
  );
}

function isMissingRuntimeConfigError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("Missing required runtime configuration") ||
    error.message.includes("Invalid supabaseUrl")
  );
}

const authorizeRequest = defineMiddleware(async (context, next) => {
  context.locals.cspNonce = createCspNonce();
  const routePath = normalizePath(context.url.pathname, import.meta.env.BASE_URL);

  if (isStaticAssetPath(routePath)) {
    return next();
  }

  const isApiRoute = routePath.startsWith("/api/");
  const isPublicRoute = PUBLIC_PATHS.has(routePath);
  const isPublicApi =
    routePath === "/api/auth/login" ||
    routePath === "/api/auth/forgot-password" ||
    routePath === "/api/auth/exchange";

  const disabledModule = disabledModuleForPath(routePath);
  if (disabledModule) {
    const message = `Module unavailable: ${disabledModule}`;
    return isApiRoute
      ? new Response(JSON.stringify({ ok: false, error: message }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new Response("Not found", { status: 404 });
  }

  let user = null;
  try {
    const supabase = createSupabaseServerClient(
      context.request,
      context.cookies,
    );
    const {
      data: { user: authUser },
    } = await getRequestUser(supabase, context.request);
    user = authUser;
    context.locals.supabase = supabase;
    context.locals.user = user;
    context.locals.staff = user
      ? await loadStaffProfile(supabase, user.id)
      : null;
  } catch (error) {
    if (isMissingRuntimeConfigError(error)) {
      context.locals.user = null;
      context.locals.staff = null;

      if (
        isPublicRoute ||
        routePath.startsWith("/_astro/") ||
        routePath.startsWith("/fonts/") ||
        routePath.startsWith("/images/")
      ) {
        return next();
      }

      const message = isPublicApi
        ? "Team auth is temporarily unavailable due to missing runtime configuration."
        : "Team app is temporarily unavailable due to missing runtime configuration.";
      return new Response(message, { status: 503 });
    }
    throw error;
  }

  const needsPasswordChange = mustChangePassword(user);

  if (routePath === CHANGE_PASSWORD_PATH) {
    if (!user) {
      return context.redirect(teamUrl("/login"));
    }
    if (!needsPasswordChange) {
      return context.redirect(teamUrl("/"));
    }
    return next();
  }

  if (routePath === RESET_PASSWORD_PATH) {
    // The password-setup form is reachable only inside a verified recovery/invite
    // context, never from an ordinary authenticated session.
    if (!user || !hasPasswordSetupContext(context.cookies)) {
      return context.redirect(teamUrl("/login?error=reset_expired"));
    }
    return next();
  }

  if (
    user &&
    needsPasswordChange &&
    routePath !== CHANGE_PASSWORD_PATH &&
    routePath !== "/api/auth/change-password" &&
    routePath !== "/api/auth/logout" &&
    // Invited employees set their first password through the recovery/invite form.
    !(routePath === "/api/auth/reset-password" && hasPasswordSetupContext(context.cookies))
  ) {
    return context.redirect(teamUrl(CHANGE_PASSWORD_PATH));
  }

  if (isApiRoute && !isPublicApi && !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (routePath === "/dashboard") {
    return context.redirect(teamUrl("/"));
  }

  if (routePath === "/" && user && context.locals.staff) {
    return next();
  }

  if (routePath === "/" && user && !context.locals.staff) {
    if (isApiRoute) {
      return new Response("Staff profile not linked", { status: 403 });
    }
    return next();
  }

  if (routePath === "/" && !user) {
    return context.redirect(teamUrl("/login"));
  }

  if (!isPublicRoute && !isApiRoute && !user) {
    const returnTo = `${routePath}${context.url.search}`;
    return context.redirect(
      teamUrl(`/login?returnTo=${encodeURIComponent(returnTo)}`),
    );
  }

  if (
    !isPublicRoute &&
    !isApiRoute &&
    user &&
    !context.locals.staff &&
    routePath !== "/"
  ) {
    return context.redirect(teamUrl("/login?error=unlinked"));
  }

  if (routePath === "/services" && !isSalonManager(context.locals.staff)) {
    return context.redirect(teamUrl("/"));
  }

  if (routePath === "/booking-policy" && !isSalonManager(context.locals.staff)) {
    return context.redirect(teamUrl("/"));
  }

  if (
    routePath === "/my-services" &&
    context.locals.staff &&
    isSalonManager(context.locals.staff)
  ) {
    return context.redirect(teamUrl("/services"));
  }

  if (routePath === "/login" && user && context.locals.staff) {
    if (needsPasswordChange) {
      return context.redirect(teamUrl(CHANGE_PASSWORD_PATH));
    }
    return context.redirect(teamUrl("/"));
  }

  return next();
});

function applySecurityHeaders(response: Response, nonce: string) {
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(nonce),
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  return response;
}

export const onRequest = defineMiddleware(async (context, next) =>
  applySecurityHeaders(
    (await authorizeRequest(context, next)) as Response,
    context.locals.cspNonce,
  ),
);
