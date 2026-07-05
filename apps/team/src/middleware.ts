import { defineMiddleware } from "astro:middleware";
import {
  isSalonManager,
  loadStaffProfile,
  mustChangePassword,
} from "./lib/auth";
import { createSupabaseServerClient, teamUrl } from "./lib/supabase-server";

const PUBLIC_PATHS = new Set(["/login"]);
const CHANGE_PASSWORD_PATH = "/change-password";

function normalizePath(pathname: string, base: string) {
  const baseNormalized = base.endsWith("/") ? base.slice(0, -1) : base;
  if (baseNormalized && pathname.startsWith(baseNormalized)) {
    return pathname.slice(baseNormalized.length) || "/";
  }
  return pathname;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const routePath = normalizePath(context.url.pathname, import.meta.env.BASE_URL);
  const isApiRoute = routePath.startsWith("/api/");
  const isPublicRoute = PUBLIC_PATHS.has(routePath);
  const isPublicApi = routePath === "/api/auth/login";

  let user = null;
  try {
    const supabase = createSupabaseServerClient(
      context.request,
      context.cookies,
    );
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
    context.locals.supabase = supabase;
    context.locals.user = user;
    context.locals.staff = user
      ? await loadStaffProfile(supabase, user.id)
      : null;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Missing required runtime configuration")
    ) {
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

  if (
    user &&
    needsPasswordChange &&
    routePath !== "/api/auth/change-password" &&
    routePath !== "/api/auth/logout"
  ) {
    return context.redirect(teamUrl(CHANGE_PASSWORD_PATH));
  }

  if (isApiRoute && !isPublicApi && !user) {
    return new Response("Unauthorized", { status: 401 });
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
    return context.redirect(teamUrl("/login"));
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
