import { IDLE_LOCK_MS, SESSION_MODE_COOKIE } from "../lib/auth-session";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

function readSessionMode(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SESSION_MODE_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function findLogoutAction(): string | null {
  const form = document.querySelector<HTMLFormElement>('form[action*="/api/auth/logout"]');
  return form?.action ?? null;
}

function submitLogout(logoutUrl: string) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = logoutUrl;
  form.hidden = true;
  document.body.appendChild(form);
  form.submit();
}

function initSessionGuard() {
  const mode = readSessionMode();
  if (mode === "remember") return;

  const logoutUrl = findLogoutAction();
  if (!logoutUrl) return;

  let idleTimer = window.setTimeout(onIdleLock, IDLE_LOCK_MS);

  function onIdleLock() {
    submitLogout(logoutUrl);
  }

  function resetIdleTimer() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(onIdleLock, IDLE_LOCK_MS);
  }

  for (const eventName of ACTIVITY_EVENTS) {
    document.addEventListener(eventName, resetIdleTimer, { passive: true });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resetIdleTimer();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSessionGuard);
} else {
  initSessionGuard();
}
