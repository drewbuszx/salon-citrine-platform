/**
 * Scroll position save/restore and unsaved-form warnings for team app navigation.
 */

const SCROLL_PREFIX = "team-scroll:";
const DEFAULT_KEY = () => location.pathname + location.search;

export function saveScrollPosition(key = DEFAULT_KEY()) {
  try {
    sessionStorage.setItem(SCROLL_PREFIX + key, String(window.scrollY));
  } catch {
    /* ignore */
  }
}

export function restoreScrollPosition(key = DEFAULT_KEY()) {
  try {
    const raw = sessionStorage.getItem(SCROLL_PREFIX + key);
    if (raw == null) return false;
    const y = Number(raw);
    if (!Number.isFinite(y)) return false;
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
    });
    return true;
  } catch {
    return false;
  }
}

export function clearScrollPosition(key = DEFAULT_KEY()) {
  try {
    sessionStorage.removeItem(SCROLL_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function initScrollRestore(root: Document | HTMLElement = document) {
  const shell = root.querySelector<HTMLElement>(".team-shell");
  if (!shell || shell.dataset.scrollRestoreReady === "1") return;
  shell.dataset.scrollRestoreReady = "1";

  restoreScrollPosition();

  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }
    try {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
    } catch {
      return;
    }
    link.addEventListener("click", () => {
      saveScrollPosition();
    });
  });
}

export function initUnsavedFormWarning(root: Document | HTMLElement = document) {
  if (root instanceof Document && (root as Document).documentElement.dataset.unsavedWarnReady === "1") {
    return;
  }
  if (root instanceof HTMLElement && root.dataset.unsavedWarnReady === "1") return;

  const mark = root instanceof Document ? root.documentElement : root;
  mark.dataset.unsavedWarnReady = "1";

  root.querySelectorAll<HTMLFormElement>("form[data-unsaved-warn]").forEach((form) => {
    let dirty = false;
    const markDirty = () => {
      dirty = true;
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", () => {
      dirty = false;
    });
    window.addEventListener("beforeunload", (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  });
}

export function initNavState() {
  initScrollRestore();
  initUnsavedFormWarning();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavState);
  } else {
    initNavState();
  }
  document.addEventListener("astro:page-load", initNavState);
}
