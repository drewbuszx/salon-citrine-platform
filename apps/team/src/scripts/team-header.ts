import { initNetworkStatus } from "../lib/network-status";

/**
 * Team header — mobile drawer, desktop profile menu, nav scroll fades, compact title on scroll.
 */

function initNavScrollFade(wrap: HTMLElement) {
  const nav = wrap.querySelector<HTMLElement>(".team-bar__nav");
  if (!nav || wrap.dataset.scrollFadeReady === "1") return;
  wrap.dataset.scrollFadeReady = "1";

  function update() {
    const { scrollLeft, scrollWidth, clientWidth } = nav;
    wrap.classList.toggle("is-scrollable-start", scrollLeft > 4);
    wrap.classList.toggle("is-scrollable-end", scrollLeft + clientWidth < scrollWidth - 4);
  }

  nav.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(nav);
  update();
}

function initMobileDrawer() {
  const drawer = document.querySelector<HTMLElement>("[data-mobile-drawer]");
  const backdrop = document.querySelector<HTMLElement>("[data-drawer-backdrop]");
  const openBtn = document.querySelector<HTMLButtonElement>("[data-mobile-menu-open]");
  const closeBtn = document.querySelector<HTMLButtonElement>("[data-drawer-close]");
  if (!drawer || !openBtn) return;
  if (drawer.dataset.drawerReady === "1") return;
  drawer.dataset.drawerReady = "1";

  const MOBILE_MQ = window.matchMedia("(max-width: 1100px)");
  let lastFocus: HTMLElement | null = null;

  function focusables() {
    return Array.from(
      drawer.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((el) => !el.closest("[hidden]") && el.offsetParent !== null);
  }

  function openDrawer() {
    if (!MOBILE_MQ.matches) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawer.classList.add("is-open");
    drawer.removeAttribute("inert");
    backdrop?.removeAttribute("hidden");
    openBtn.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("team-drawer-open");
    closeBtn?.focus();
  }

  function closeDrawer(returnFocus = true) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("inert", "");
    backdrop?.setAttribute("hidden", "");
    openBtn.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("team-drawer-open");
    if (returnFocus) {
      (lastFocus ?? openBtn).focus();
    }
  }

  openBtn.addEventListener("click", () => {
    if (drawer.classList.contains("is-open")) closeDrawer();
    else openDrawer();
  });
  closeBtn?.addEventListener("click", () => closeDrawer());
  backdrop?.addEventListener("click", () => closeDrawer());

  drawer.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => closeDrawer(false));
  });

  document.addEventListener("keydown", (event) => {
    if (!drawer.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key === "Tab") {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  MOBILE_MQ.addEventListener("change", () => {
    if (!MOBILE_MQ.matches) closeDrawer(false);
  });

  if (MOBILE_MQ.matches) {
    drawer.setAttribute("inert", "");
  }
}

function initDesktopProfileMenu() {
  const profileDropdown = document.querySelector<HTMLElement>("[data-profile-dropdown]");
  const profileTrigger = document.querySelector<HTMLButtonElement>("[data-profile-trigger]");
  const profileMenu = document.querySelector<HTMLElement>("[data-profile-menu]");
  if (!profileDropdown || !profileTrigger || !profileMenu) return;
  if (profileDropdown.dataset.profileReady === "1") return;
  profileDropdown.dataset.profileReady = "1";

  const DESKTOP_MQ = window.matchMedia("(min-width: 1101px)");

  function menuItems() {
    return Array.from(
      profileMenu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
    );
  }

  function closeProfileMenu(returnFocus = false) {
    profileDropdown.classList.remove("is-open");
    profileTrigger.setAttribute("aria-expanded", "false");
    profileMenu.setAttribute("hidden", "");
    if (returnFocus) profileTrigger.focus();
  }

  function openProfileMenu(focusFirst = true) {
    if (!DESKTOP_MQ.matches) return;
    profileDropdown.classList.add("is-open");
    profileTrigger.setAttribute("aria-expanded", "true");
    profileMenu.removeAttribute("hidden");
    if (focusFirst) menuItems()[0]?.focus();
  }

  profileTrigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!DESKTOP_MQ.matches) return;
    if (profileDropdown.classList.contains("is-open")) closeProfileMenu();
    else openProfileMenu();
  });

  document.addEventListener("click", (event) => {
    if (!profileDropdown.contains(event.target as Node)) closeProfileMenu();
  });

  profileTrigger.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeProfileMenu(true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!profileDropdown.classList.contains("is-open")) {
        openProfileMenu(event.key === "ArrowUp");
      } else {
        const items = menuItems();
        const index = items.findIndex((item) => item === document.activeElement);
        const dir = event.key === "ArrowDown" ? 1 : -1;
        const next =
          index === -1
            ? dir === 1
              ? 0
              : items.length - 1
            : (index + dir + items.length) % items.length;
        items[next]?.focus();
      }
    }
  });

  profileMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeProfileMenu(true);
    }
    if (event.key === "Tab") closeProfileMenu();
  });
}

function initCompactPageTitle() {
  const shell = document.querySelector<HTMLElement>(".team-shell");
  const titleEl = document.querySelector<HTMLElement>("[data-page-title]");
  if (!shell || !titleEl || shell.dataset.compactTitleReady === "1") return;
  shell.dataset.compactTitleReady = "1";

  const MOBILE_MQ = window.matchMedia("(max-width: 1100px)");
  const threshold = 56;
  let ticking = false;

  function update() {
    ticking = false;
    const useCompactTitle = MOBILE_MQ.matches && window.scrollY > threshold;
    shell.classList.toggle("is-page-scrolled", useCompactTitle);
    titleEl.hidden = !useCompactTitle;
  }

  MOBILE_MQ.addEventListener("change", update);
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

export function initTeamHeader() {
  initNetworkStatus();
  document.querySelectorAll<HTMLElement>(".team-bar__nav-wrap").forEach(initNavScrollFade);
  initMobileDrawer();
  initDesktopProfileMenu();
  initCompactPageTitle();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTeamHeader);
  } else {
    initTeamHeader();
  }
  document.addEventListener("astro:page-load", initTeamHeader);
}
