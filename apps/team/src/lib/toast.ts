/** Lightweight toast notifications — Salon Citrine team app */

export type ToastVariant = "success" | "error" | "info";

const TOAST_DURATION_MS = 4500;

function getRegion(): HTMLElement {
  let region = document.getElementById("team-toast-region");
  if (!region) {
    region = document.createElement("div");
    region.id = "team-toast-region";
    region.className = "team-toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-relevant", "additions");
    document.body.appendChild(region);
  }
  return region;
}

export function showToast(message: string, variant: ToastVariant = "info") {
  if (!message.trim()) return;

  const region = getRegion();
  const toast = document.createElement("div");
  toast.className = `team-toast team-toast--${variant}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  region.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  const dismiss = () => {
    toast.classList.remove("is-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 400);
  };

  window.setTimeout(dismiss, TOAST_DURATION_MS);
  toast.addEventListener("click", dismiss);
}

export function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const msg = error.message.trim();
    if (/failed to fetch|network/i.test(msg)) {
      return "Connection problem — check your network and try again.";
    }
    if (/unauthorized|401/i.test(msg)) return "Session expired — sign in again.";
    if (/not found|404/i.test(msg)) return "That item is no longer available.";
    if (msg) return msg;
  }
  return fallback;
}
