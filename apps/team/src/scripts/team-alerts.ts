import type { TeamAlert, TeamAlertKind, TeamAlertSeverity } from "../lib/alerts";

const DISMISSED_KEY = "team-alerts-dismissed";

type TeamAlertItem = TeamAlert & { createdAt?: string };

type AlertsResponse = {
  ok: boolean;
  error?: string;
  alerts?: TeamAlertItem[];
  unreadCount?: number;
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

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function resolveHref(href: string, teamBase: string) {
  if (/^https?:\/\//i.test(href)) return href;
  const base = teamBase.replace(/\/$/, "");
  const path = href.startsWith("/") ? href : `/${href}`;
  return base ? `${base}${path}` : path;
}

function formatRelativeTime(iso?: string) {
  if (!iso) return "";
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function iconSvg(kind: TeamAlertKind) {
  if (kind === "waitlist") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (kind === "stock") {
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

function alertRowHtml(alert: TeamAlertItem, teamBase: string) {
  const href = resolveHref(alert.href, teamBase);
  const time = formatRelativeTime(alert.createdAt);
  return `
    <li class="team-alerts__item" role="none">
      <a
        class="team-alerts__row ${severityClass(alert.severity)}"
        href="${escapeHtml(href)}"
        role="menuitem"
        data-alert-id="${escapeHtml(alert.id)}"
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

  const loadingEl = panel.querySelector<HTMLElement>("[data-alerts-loading]");
  const errorEl = panel.querySelector<HTMLElement>("[data-alerts-error]");
  const listEl = panel.querySelector<HTMLElement>("[data-alerts-list]");
  const emptyEl = panel.querySelector<HTMLElement>("[data-alerts-empty]");
  const markAllBtn = panel.querySelector<HTMLButtonElement>("[data-alerts-mark-all]");
  const retryBtn = panel.querySelector<HTMLButtonElement>("[data-alerts-retry]");

  let dismissed = loadDismissed();
  let visibleAlerts: TeamAlertItem[] = [];
  let unreadCount = 0;
  let loading = false;

  function setUnreadCount(count: number) {
    unreadCount = count;
    root.dataset.unreadCount = String(count);
    if (trigger) {
      trigger.dataset.unreadCount = String(count);
      trigger.setAttribute("aria-label", count > 0 ? `${count} unread alerts` : "Notifications");
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

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = visibleAlerts.map((alert) => alertRowHtml(alert, teamBase)).join("");
    setUnreadCount(visibleAlerts.length);
    showState(visibleAlerts.length ? "list" : "empty");
  }

  function dismissAlert(id: string) {
    dismissed.add(id);
    saveDismissed(dismissed);
    visibleAlerts = visibleAlerts.filter((alert) => alert.id !== id);
    renderList();
  }

  function markAllRead() {
    visibleAlerts.forEach((alert) => dismissed.add(alert.id));
    saveDismissed(dismissed);
    visibleAlerts = [];
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

      const alerts = data.alerts ?? [];
      visibleAlerts = alerts.filter((alert) => !dismissed.has(alert.id));
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
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-alert-id]");
    if (!link) return;
    const id = link.dataset.alertId;
    if (id) dismissAlert(id);
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
      }
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
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
