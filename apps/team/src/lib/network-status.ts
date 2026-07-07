import { showToast } from "./toast";

let wired = false;

/** Surfaces offline / reconnected state — Fix #45. */
export function initNetworkStatus() {
  if (wired || typeof window === "undefined") return;
  wired = true;

  if (!navigator.onLine) {
    showToast("You're offline — changes may not save until you reconnect.", "error");
  }

  window.addEventListener("offline", () => {
    showToast("Connection lost — check your network before saving.", "error");
  });

  window.addEventListener("online", () => {
    showToast("Back online.", "success");
  });
}
