import { formatDayParam, parseDayParam, shiftDay } from "../lib/calendar";

export type DayCalendarShortcutHandlers = {
  closeModals: () => void;
  openNewAppointment: () => void;
};

type DayCalConfig = {
  dayParam: string;
  reloadUrl: string;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const input = target as HTMLInputElement;
  const type = input.type.toLowerCase();
  return !["checkbox", "radio", "button", "submit", "reset", "file", "hidden", "range", "color"].includes(
    type,
  );
}

function bookBaseUrl(reloadUrl: string): string {
  return reloadUrl.split("?")[0];
}

function navigateToDay(config: DayCalConfig, dayParam: string) {
  window.location.href = `${bookBaseUrl(config.reloadUrl)}?day=${dayParam}`;
}

function readConfig(): DayCalConfig | null {
  const configEl = document.getElementById("day-cal-config");
  if (!configEl) return null;
  try {
    return JSON.parse(configEl.textContent || "{}") as DayCalConfig;
  } catch {
    return null;
  }
}

export function initDayCalendarShortcuts(
  root: HTMLElement,
  handlers: DayCalendarShortcutHandlers,
) {
  if (root.dataset.shortcutsInit === "true") return;
  root.dataset.shortcutsInit = "true";

  const config = readConfig();
  if (!config?.dayParam || !config.reloadUrl) return;

  const helpEl = root.querySelector<HTMLElement>("[data-cal-shortcuts-help]");
  const helpPanel = root.querySelector<HTMLElement>("[data-cal-shortcuts-panel]");

  function isHelpOpen() {
    return Boolean(helpEl && !helpEl.hidden);
  }

  function openHelp() {
    if (!helpEl) return;
    helpEl.hidden = false;
    helpEl.setAttribute("aria-hidden", "false");
    helpPanel?.querySelector<HTMLElement>("[data-cal-shortcuts-close]")?.focus();
  }

  function closeHelp() {
    if (!helpEl) return;
    helpEl.hidden = true;
    helpEl.setAttribute("aria-hidden", "true");
  }

  function toggleHelp() {
    if (isHelpOpen()) closeHelp();
    else openHelp();
  }

  function focusSearch(): boolean {
    const drawer = document.getElementById("day-cal-drawer");
    const drawerOpen = drawer?.classList.contains("is-open") ?? false;
    const search =
      root.querySelector<HTMLInputElement>("[data-cal-search]") ??
      root.querySelector<HTMLInputElement>('input[name="client_name"]');
    if (!search || search.disabled) return false;
    if (!drawerOpen && search.name === "client_name") return false;
    search.focus();
    search.select();
    return true;
  }

  root.querySelectorAll("[data-cal-shortcuts-close]").forEach((el) => {
    el.addEventListener("click", closeHelp);
  });

  document.addEventListener("keydown", (event) => {
    if (!document.contains(root)) return;

    if (event.key === "Escape") {
      if (isHelpOpen()) {
        event.preventDefault();
        closeHelp();
        return;
      }
      handlers.closeModals();
      return;
    }

    if (isTypingTarget(event.target)) return;

    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      toggleHelp();
      return;
    }

    if (event.key === "t" || event.key === "T") {
      event.preventDefault();
      navigateToDay(config, formatDayParam(new Date()));
      return;
    }

    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      handlers.openNewAppointment();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const day = parseDayParam(config.dayParam);
      navigateToDay(config, formatDayParam(shiftDay(day, -1)));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const day = parseDayParam(config.dayParam);
      navigateToDay(config, formatDayParam(shiftDay(day, 1)));
      return;
    }

    if (event.key === "/" && !event.shiftKey) {
      if (focusSearch()) event.preventDefault();
    }
  });
}
