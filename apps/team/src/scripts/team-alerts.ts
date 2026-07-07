import {
  countUnreadAlerts,
  dismissAlert,
  formatAlertBadgeCount,
  isAlertUnread,
  loadDismissedAlerts,
  saveDismissedAlerts,
  type DismissedAlertsState,
  type TeamAlert,
  type TeamAlertKind,
  type TeamAlertSeverity,
} from "../lib/alerts";

type AlertsResponse = {
  ok: boolean;
  error?: string;
  alerts?: TeamAlert[];
};

export type TeamAlertsHandle = {
  root: HTMLElement;
  panel: HTMLElement;
  refresh: () => Promise<void>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  getUnreadCount: () => number;
};

const handles = new WeakMap<HTMLElement, TeamAlertsHandle>();

function resolveHref(href: string, teamBase: string) {
  if (/^https?:\/\//i.test(href)) return href;
  const base = teamBase.replace(/\/$/, "");
  const path = href.startsWith("/") ? href : `/${href}`;
  return base ? `${base}${path}` : path;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function iconSvg(kind: TeamAlertKind) {
  if (kind === "waitlist-active") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (kind === "low-stock") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7.7L12 12.5l8.7-4.8M12 22V12.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function severityClass(severity: TeamAlertSeverity) {
  return `team-alerts__row--${severity}`;
}

function loadingSkeletonHtml() {
  return Array.from({ length: 3 }, () => `
    <li class="team-alerts__skeleton" aria-hidden="true">
      <span class="team-alerts__skeleton-icon"></span>
      <span class="team-alerts__skeleton-copy">
        <span class="team-alerts__skeleton-line team-alerts__skeleton-line--wide"></span>
        <span class="team-alerts__skeleton-line team-alerts__skeleton-line--medium"></span>
      </span>
    </li>`).join("");
}

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 45) return "Just now";
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.round(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.max(1, Math.round(diffSec / 3600));
    return `${hours}h ago`;
  }
  const days = Math.max(1, Math.round(diffSec / 86400));
  return `${days}d ago`;
}

function alertRowHtml(alert: TeamAlert, teamBase: string) {
  const href = resolveHref(alert.href, teamBase);
  const time = formatRelativeTime(alert.generatedAt);
  return `
    <li class="team-alerts__item" role="none">
      <a
        class="team-alerts__row ${severityClass(alert.severity)}"
        href="${escapeHtml(href)}"
        role="menuitem"
        data-alert-kind="${escapeHtml(alert.kind)}"
      >
        <span class="team-alerts__icon team-alerts__icon--${alert.kind}" aria-hidden="true">
          ${iconSvg(alert.kind)}
        </span>
        <span class="team-alerts__copy">
          <span class="team-alerts__row-title">${escapeHtml(alert.title)}</span>
          <span class="team-alerts__row-body">${escapeHtml(alert.message)}</span>
          ${time ? `<span class="team-alerts__row-time">${escapeHtml(time)}</span>` : ""}
        </span>
        <span class="team-alerts__chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </a>
    </li>`;
}

function closeProfileMenu() {
  const profileDropdown = document.querySelector<HTMLElement>("[data-profile-dropdown].is-open");
  const profileTrigger = document.querySelector<HTMLButtonElement>("[data-profile-trigger]");
  const profileMenu = document.querySelector<HTMLElement>("[data-profile-menu]");
  if (!profileDropdown || !profileTrigger || !profileMenu) return;
  profileDropdown.classList.remove("is-open");
  profileTrigger.setAttribute("aria-expanded", "false");
  profileMenu.setAttribute("hidden", "");
}

function initOne(root: HTMLElement): TeamAlertsHandle {
  const panel = root.matches("[data-alerts-panel]")
    ? root
    : root.querySelector<HTMLElement>("[data-alerts-panel]");
  if (!panel) {
    throw new Error("Team alerts panel not found");
  }

  const apiUrl = root.dataset.alertsApi ?? "";
  const teamBase = root.dataset.teamBase ?? "";
  const dropdown = root.closest<HTMLElement>("[data-alerts-dropdown]");
  const trigger = dropdown?.querySelector<HTMLButtonElement>("[data-alerts-trigger]") ?? null;
  const badge = dropdown?.querySelector<HTMLElement>("[data-alerts-badge]") ?? null;

  const loadingEl = panel.querySelector<HTMLElement>("[data-alerts-loading]");
  const errorEl = panel.querySelector<HTMLElement>("[data-alerts-error]");
  const listEl = panel.querySelector<HTMLElement>("[data-alerts-list]");
  const emptyEl = panel.querySelector<HTMLElement>("[data-alerts-empty]");
  const markAllBtn = panel.querySelector<HTMLButtonElement>("[data-alerts-mark-all]");
  const retryBtn = panel.querySelector<HTMLButtonElement>("[data-alerts-retry]");

  let dismissed: DismissedAlertsState = loadDismissedAlerts();
  let allAlerts: TeamAlert[] = [];
  let visibleAlerts: TeamAlert[] = [];
  let unreadCount = 0;
  let loading = false;

  function setUnreadCount(count: number) {
    unreadCount = count;
    root.dataset.unreadCount = String(count);
    if (trigger) {
      trigger.dataset.unreadCount = String(count);
      const label =
        count > 0 ? `Notifications, ${count} unread` : "Notifications";
      trigger.setAttribute("aria-label", label);
    }
    if (badge) {
      const badgeText = formatAlertBadgeCount(count);
      if (badgeText) {
        badge.textContent = badgeText;
        badge.removeAttribute("hidden");
      } else {
        badge.textContent = "";
        badge.setAttribute("hidden", "");
      }
    }
  }

  function showState(state: "loading" | "error" | "empty" | "list") {
    if (loadingEl) loadingEl.hidden = state !== "loading";
    if (errorEl) errorEl.hidden = state !== "error";
    if (listEl) listEl.hidden = state !== "list";
    if (emptyEl) emptyEl.hidden = state !== "empty";
    if (markAllBtn) {
      markAllBtn.hidden = state !== "list" || visibleAlerts.length === 0;
    }
  }

  function syncVisibleAlerts() {
    visibleAlerts = allAlerts.filter((alert) => isAlertUnread(alert, dismissed));
    setUnreadCount(countUnreadAlerts(allAlerts, dismissed));
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = visibleAlerts.map((alert) => alertRowHtml(alert, teamBase)).join("");
    showState(visibleAlerts.length ? "list" : "empty");
  }

  function dismissOne(alert: TeamAlert) {
    dismissed = dismissAlert(dismissed, alert);
    saveDismissedAlerts(dismissed);
    syncVisibleAlerts();
    renderList();
  }

  function markAllRead() {
    for (const alert of allAlerts) {
      if (isAlertUnread(alert, dismissed)) {
        dismissed = dismissAlert(dismissed, alert);
      }
    }
    saveDismissedAlerts(dismissed);
    syncVisibleAlerts();
    renderList();
  }

  async function refresh() {
    if (!apiUrl || loading) return;
    loading = true;
    showState("loading");
    if (loadingEl) {
      loadingEl.innerHTML = `<ul class="team-alerts__list" role="list">${loadingSkeletonHtml()}</ul>`;
    }

    try {
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const data = (await response.json()) as AlertsResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not load alerts");
      }

      allAlerts = data.alerts ?? [];
      dismissed = loadDismissedAlerts();
      syncVisibleAlerts();
      renderList();
    } catch (error) {
      setUnreadCount(0);
      showState("error");
      const hint = errorEl?.querySelector<HTMLElement>("[data-alerts-error-hint]");
      if (hint) {
        hint.textContent =
          error instanceof Error ? error.message : "Check your connection and try again.";
      }
    } finally {
      loading = false;
    }
  }

  function open() {
    if (!dropdown) return;
    closeProfileMenu();
    dropdown.classList.add("is-open");
    trigger?.setAttribute("aria-expanded", "true");
    panel.removeAttribute("hidden");
    void refresh();
  }

  function close() {
    if (!dropdown) return;
    dropdown.classList.remove("is-open");
    trigger?.setAttribute("aria-expanded", "false");
    panel.setAttribute("hidden", "");
  }

  function toggle() {
    if (dropdown?.classList.contains("is-open")) close();
    else open();
  }

  markAllBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    markAllRead();
  });

  retryBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    void refresh();
  });

  listEl?.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-alert-kind]");
    if (!link) return;
    const kind = link.dataset.alertKind as TeamAlertKind | undefined;
    const alert = allAlerts.find((item) => item.kind === kind);
    if (alert) dismissOne(alert);
  });

  if (trigger && dropdown) {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggle();
    });

    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target as Node)) close();
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        trigger.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!dropdown.classList.contains("is-open")) open();
      }
      if (event.key === "ArrowUp" && !dropdown.classList.contains("is-open")) {
        event.preventDefault();
        open();
      }
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        trigger.focus();
      }
      if (event.key === "Tab") close();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refresh();
  });

  const handle: TeamAlertsHandle = {
    root,
    panel,
    refresh,
    open,
    close,
    toggle,
    getUnreadCount: () => unreadCount,
  };

  handles.set(root, handle);
  root.dataset.alertsReady = "1";
  void refresh();

  return handle;
}

export function getTeamAlerts(root: HTMLElement): TeamAlertsHandle | undefined {
  return handles.get(root);
}

export function closeTeamAlertsDropdown() {
  document.querySelectorAll<HTMLElement>("[data-alerts-dropdown].is-open").forEach((dropdown) => {
    const root = dropdown.querySelector<HTMLElement>("[data-team-alerts]");
    if (root) getTeamAlerts(root)?.close();
  });
}

export function initTeamAlerts(scope: ParentNode = document): TeamAlertsHandle[] {
  const roots = scope.querySelectorAll<HTMLElement>(
    "[data-team-alerts]:not([data-alerts-ready])",
  );
  return Array.from(roots).map(initOne);
}

if (typeof document !== "undefined") {
  const boot = () => initTeamAlerts();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("astro:page-load", boot);
}
