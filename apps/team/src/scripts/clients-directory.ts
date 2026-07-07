import type { ClientListItem, ClientSortKey, PossibleDuplicate } from "../lib/clients-types";

type DirectoryConfig = {
  searchApi: string;
  createApi: string;
  clientApi: string;
  clientsBase: string;
  bookUrl: string;
  initialQuery: string;
  initialClients: ClientListItem[];
  initialTotal: number | null;
};

const COLUMN_KEYS = ["client", "contact", "provider", "lastVisit", "nextAppt", "visits", "ltv"] as const;
const DRAWER_MQ = window.matchMedia("(min-width: 1024px)");
const STORAGE_COLUMNS = "clients-directory:columns";

declare global {
  interface Window {
    __clientsDirectoryConfig?: DirectoryConfig;
  }
}

function config(): DirectoryConfig {
  const cfg = window.__clientsDirectoryConfig;
  if (!cfg) throw new Error("Clients directory config missing");
  return cfg;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function announce(message: string) {
  const live = document.querySelector<HTMLElement>("[data-sr-live]");
  if (!live) return;
  live.textContent = "";
  requestAnimationFrame(() => {
    live.textContent = message;
  });
}

function phoneHref(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? `tel:${digits}` : null;
}

function emailHref(value: string | null) {
  const email = value?.trim();
  return email ? `mailto:${email}` : null;
}

function emptyContactLabel(kind: "phone" | "email") {
  return kind === "phone" ? "No phone" : "No email";
}

function getVisibleColumns(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_COLUMNS);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new Set(parsed);
      }
    }
  } catch {
    /* ignore */
  }
  return new Set(COLUMN_KEYS);
}

function saveVisibleColumns(columns: Set<string>) {
  try {
    localStorage.setItem(STORAGE_COLUMNS, JSON.stringify([...columns]));
  } catch {
    /* ignore */
  }
}

class ClientsDirectory {
  private root: HTMLElement;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingCount = 0;
  private sort: ClientSortKey = "name";
  private page = 1;
  private perPage = 25;
  private lastFocus: HTMLElement | null = null;
  private openMenu: HTMLElement | null = null;
  private menuTrigger: HTMLElement | null = null;
  private repositionHandler: (() => void) | null = null;
  private summaryFilter: "upcoming" | "noUpcoming" | null = null;
  private visibleColumns = getVisibleColumns();
  private pendingForceCreate = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.bindEvents();
    this.syncColumnToggles();
    this.loadClients(this.getSearchTerm(), { announce: false });
  }

  private qs<T extends HTMLElement>(selector: string) {
    return this.root.querySelector<T>(selector) ?? document.querySelector<T>(selector);
  }

  private getSearchTerm() {
    return this.qs<HTMLInputElement>("[data-search-input]")?.value.trim() ?? "";
  }

  private getFilters() {
    const provider =
      this.root.querySelector<HTMLInputElement>("[data-filter-provider]:checked")?.value?.trim() ?? "";
    const tag = this.root.querySelector<HTMLInputElement>("[data-filter-tag]:checked")?.value?.trim() ?? "";
    const referral =
      this.root.querySelector<HTMLInputElement>("[data-filter-referral]:checked")?.value?.trim() ?? "";
    const purchased = Boolean(this.root.querySelector<HTMLInputElement>("[data-filter-purchased]")?.checked);
    const hasVisits = Boolean(this.root.querySelector<HTMLInputElement>("[data-filter-has-visits]")?.checked);
    return { provider, tag, referral, purchased, hasVisits };
  }

  private bindEvents() {
    const { initialQuery, initialClients, initialTotal } = config();

    const input = this.qs<HTMLInputElement>("[data-search-input]");
    input?.addEventListener("input", () => {
      this.syncSearchClear();
      this.scheduleLoad();
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        input.value = "";
        this.syncSearchClear();
        this.scheduleLoad();
      }
    });

    const clearBtn = this.qs<HTMLButtonElement>("[data-search-clear]");
    clearBtn?.addEventListener("click", () => {
      if (input) input.value = "";
      this.syncSearchClear();
      input?.focus();
      this.scheduleLoad();
    });
    this.syncSearchClear();

    this.qs<HTMLSelectElement>("[data-sort-select]")?.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement;
      this.sort = (target.value as ClientSortKey) || "name";
      this.page = 1;
      announce(`Sorted by ${target.selectedOptions[0]?.textContent ?? "name"}`);
      this.scheduleLoad();
    });

    this.root.querySelectorAll("[data-filter-provider], [data-filter-tag], [data-filter-referral]").forEach((el) => {
      el.addEventListener("change", () => {
        this.page = 1;
        this.scheduleLoad();
      });
    });
    this.root.querySelector("[data-filter-purchased]")?.addEventListener("change", () => {
      this.page = 1;
      this.scheduleLoad();
    });
    this.root.querySelector("[data-filter-has-visits]")?.addEventListener("change", () => {
      this.page = 1;
      this.scheduleLoad();
    });

    this.root.closest(".team-list-layout")?.addEventListener("team-filters-restored", () => {
      this.page = 1;
      this.scheduleLoad();
    });

    this.qs<HTMLButtonElement>("[data-filter-clear-all]")?.addEventListener("click", () => {
      this.clearAllFilters();
    });

    this.qs<HTMLButtonElement>("[data-add-open]")?.addEventListener("click", () => this.openAddModal());
    document.querySelectorAll("[data-modal-close]").forEach((el) => {
      el.addEventListener("click", () => this.closeAddModal());
    });

    document.querySelectorAll("[data-drawer-close]").forEach((el) => {
      el.addEventListener("click", () => this.closeDrawer());
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (this.openMenu) {
          this.closeRowMenu(true);
          return;
        }
        const drawer = this.qs<HTMLElement>("[data-preview-drawer]");
        if (drawer && !drawer.hidden) {
          this.closeDrawer();
          return;
        }
        const modal = document.querySelector<HTMLElement>("[data-add-modal]");
        if (modal && !modal.hidden) this.closeAddModal();
      }
    });

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (this.openMenu && !event.target.closest("[data-row-menu]")) {
        this.closeRowMenu();
      }
    });

    this.qs<HTMLFormElement>("[data-add-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitAddForm();
    });

    this.qs<HTMLButtonElement>("[data-pagination-prev]")?.addEventListener("click", () => {
      if (this.page > 1) {
        this.page -= 1;
        this.scheduleLoad();
      }
    });
    this.qs<HTMLButtonElement>("[data-pagination-next]")?.addEventListener("click", () => {
      this.page += 1;
      this.scheduleLoad();
    });
    this.qs<HTMLSelectElement>("[data-per-page]")?.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement;
      this.perPage = Number.parseInt(target.value, 10) || 25;
      this.page = 1;
      this.scheduleLoad();
    });

    this.root.querySelectorAll<HTMLInputElement>("[data-column-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.columnToggle ?? "";
        if (!key) return;
        if (input.checked) this.visibleColumns.add(key);
        else this.visibleColumns.delete(key);
        if (this.visibleColumns.size === 0) {
          this.visibleColumns.add("client");
          input.checked = true;
        }
        saveVisibleColumns(this.visibleColumns);
        this.applyColumnVisibility();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-summary-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.summaryFilter as "upcoming" | "noUpcoming" | undefined;
        if (filter !== "upcoming" && filter !== "noUpcoming") return;
        this.summaryFilter = this.summaryFilter === filter ? null : filter;
        this.page = 1;
        this.syncSummaryPressed();
        this.scheduleLoad();
      });
    });

    this.qs<HTMLButtonElement>("[data-empty-clear]")?.addEventListener("click", () => {
      this.clearAllFilters();
    });

    if (initialQuery.trim().length === 1) {
      this.showStatus("Type at least 2 characters to search.");
    } else if (initialClients.length > 0) {
      this.renderResults(initialClients, {
        total: initialTotal ?? initialClients.length,
        filteredTotal: initialClients.length,
        filtersApplied: 0,
        rangeStart: initialClients.length ? 1 : 0,
        rangeEnd: initialClients.length,
        totalPages: 1,
        page: 1,
        perPage: this.perPage,
        summary: null,
      });
    }
  }

  private clearAllFilters() {
    for (const radio of this.root.querySelectorAll<HTMLInputElement>(
      "[data-filter-provider][value=''], [data-filter-tag][value=''], [data-filter-referral][value='']",
    )) {
      radio.checked = true;
    }
    for (const checkbox of this.root.querySelectorAll<HTMLInputElement>(
      "[data-filter-purchased], [data-filter-has-visits]",
    )) {
      checkbox.checked = false;
    }
    this.summaryFilter = null;
    this.syncSummaryPressed();
    this.page = 1;
    this.renderFilterChips([]);
    this.scheduleLoad();
  }

  private syncSummaryPressed() {
    this.root.querySelectorAll<HTMLButtonElement>("[data-summary-filter]").forEach((btn) => {
      const active = btn.dataset.summaryFilter === this.summaryFilter;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  private syncColumnToggles() {
    this.root.querySelectorAll<HTMLInputElement>("[data-column-toggle]").forEach((input) => {
      const key = input.dataset.columnToggle ?? "";
      input.checked = this.visibleColumns.has(key);
    });
    this.applyColumnVisibility();
  }

  private applyColumnVisibility() {
    const table = this.qs<HTMLTableElement>(".clients-table");
    if (!table) return;
    for (const key of COLUMN_KEYS) {
      const visible = this.visibleColumns.has(key);
      table.querySelectorAll<HTMLElement>(`[data-col="${key}"]`).forEach((el) => {
        el.hidden = !visible;
      });
    }
  }

  private showStatus(message: string, isError = false) {
    const status = this.qs<HTMLElement>("[data-status]");
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle("clients-page__notice--error", isError);
  }

  private showToast(message: string) {
    const toast = document.querySelector<HTMLElement>("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  }

  private setSearchLoading(active: boolean) {
    this.loadingCount += active ? 1 : -1;
    if (this.loadingCount < 0) this.loadingCount = 0;
    const isLoading = this.loadingCount > 0;
    const wrap = this.qs<HTMLElement>("[data-search-wrap]");
    wrap?.classList.toggle("clients-page__search--loading", isLoading);
    const spinner = this.qs<HTMLElement>("[data-search-spinner]");
    const icon = this.qs<HTMLElement>("[data-search-icon]");
    if (spinner) spinner.hidden = !isLoading;
    if (icon) icon.hidden = isLoading;
    this.qs<HTMLInputElement>("[data-search-input]")?.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  private scheduleLoad() {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.loadClients(this.getSearchTerm()), 250);
  }

  private syncSearchClear() {
    const input = this.qs<HTMLInputElement>("[data-search-input]");
    const clearBtn = this.qs<HTMLButtonElement>("[data-search-clear]");
    if (!clearBtn) return;
    const hasValue = Boolean(input?.value.trim());
    clearBtn.hidden = !hasValue;
  }

  private renderFilterChips(chips: Array<{ label: string; clear: () => void }>) {
    const bar = this.qs<HTMLElement>("[data-filter-bar]");
    const wrap = this.qs<HTMLElement>("[data-active-filters]");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (chips.length === 0) {
      if (bar) bar.hidden = true;
      return;
    }
    if (bar) bar.hidden = false;
    for (const chip of chips) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clients-page__filter-chip";
      btn.innerHTML = `${escapeHtml(chip.label)} <span aria-hidden="true">×</span>`;
      btn.addEventListener("click", () => {
        chip.clear();
        this.page = 1;
        this.scheduleLoad();
      });
      wrap.appendChild(btn);
    }
  }

  private buildFilterChips() {
    const chips: Array<{ label: string; clear: () => void }> = [];
    const filters = this.getFilters();

    if (filters.provider) {
      const label =
        this.root
          .querySelector<HTMLInputElement>(`[data-filter-provider][value="${CSS.escape(filters.provider)}"]`)
          ?.closest("label")
          ?.querySelector("span")
          ?.textContent?.trim() ?? "Provider";
      chips.push({
        label: `Provider: ${label}`,
        clear: () => {
          const el = this.root.querySelector<HTMLInputElement>("[data-filter-provider][value='']");
          if (el) {
            el.checked = true;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
      });
    }
    if (filters.tag) {
      chips.push({
        label: `Tag: ${filters.tag}`,
        clear: () => {
          const el = this.root.querySelector<HTMLInputElement>("[data-filter-tag][value='']");
          if (el) {
            el.checked = true;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
      });
    }
    if (filters.referral) {
      chips.push({
        label: `Referral: ${filters.referral}`,
        clear: () => {
          const el = this.root.querySelector<HTMLInputElement>("[data-filter-referral][value='']");
          if (el) {
            el.checked = true;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
      });
    }
    if (filters.purchased) {
      chips.push({
        label: "Completed sales",
        clear: () => {
          const el = this.root.querySelector<HTMLInputElement>("[data-filter-purchased]");
          if (el) {
            el.checked = false;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
      });
    }
    if (filters.hasVisits) {
      chips.push({
        label: "Has visits",
        clear: () => {
          const el = this.root.querySelector<HTMLInputElement>("[data-filter-has-visits]");
          if (el) {
            el.checked = false;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
      });
    }
    if (this.summaryFilter === "upcoming") {
      chips.push({
        label: "Upcoming appointment",
        clear: () => {
          this.summaryFilter = null;
          this.syncSummaryPressed();
        },
      });
    } else if (this.summaryFilter === "noUpcoming") {
      chips.push({
        label: "No future appointment",
        clear: () => {
          this.summaryFilter = null;
          this.syncSummaryPressed();
        },
      });
    }
    return chips;
  }

  private updateSummary(
    summary: {
      total: number;
      newThisMonth: number;
      withUpcoming: number;
      withoutUpcoming: number;
    } | null,
  ) {
    const countEl = this.qs<HTMLElement>("[data-client-count]");
    if (countEl && summary) {
      countEl.textContent = summary.total.toLocaleString("en-US");
      countEl.setAttribute(
        "aria-label",
        summary.total === 1 ? "1 client" : `${summary.total.toLocaleString("en-US")} clients`,
      );
    }
    const set = (sel: string, value: number) => {
      const el = this.qs<HTMLElement>(sel);
      if (el) el.textContent = String(value);
    };
    if (summary) {
      set("[data-summary-total]", summary.total);
      set("[data-summary-new]", summary.newThisMonth);
      set("[data-summary-upcoming]", summary.withUpcoming);
      set("[data-summary-no-booking]", summary.withoutUpcoming);
    }
  }

  private updatePagination(meta: {
    page: number;
    perPage: number;
    totalPages: number;
    rangeStart: number;
    rangeEnd: number;
    filteredTotal: number;
  }) {
    const footer = this.qs<HTMLElement>("[data-footer]");
    if (!footer) return;

    // Footer is shown whenever there are results (range + rows per page).
    if (meta.filteredTotal <= 0) {
      footer.hidden = true;
      return;
    }
    footer.hidden = false;

    const range = this.qs<HTMLElement>("[data-page-range]");
    if (range) {
      range.textContent = `${meta.rangeStart}–${meta.rangeEnd} of ${meta.filteredTotal}`;
    }

    const multiPage = meta.totalPages > 1;
    const buttons = this.qs<HTMLElement>("[data-page-buttons]");
    if (buttons) buttons.hidden = !multiPage;
    const prev = this.qs<HTMLButtonElement>("[data-pagination-prev]");
    const next = this.qs<HTMLButtonElement>("[data-pagination-next]");
    if (prev) prev.disabled = meta.page <= 1;
    if (next) next.disabled = meta.page >= meta.totalPages;
  }

  private renderClientCell(client: ClientListItem) {
    const preferred = client.preferredName
      ? `<span class="clients-table__preferred">Goes by ${escapeHtml(client.preferredName)}</span>`
      : "";
    const tags = (client.tagLabels ?? []).slice(0, 2);
    const tagsMarkup =
      tags.length > 0
        ? `<span class="clients-table__tag-row">${tags
            .map((tag) => `<span class="clients-table__tag">${escapeHtml(tag)}</span>`)
            .join("")}</span>`
        : "";
    return `
      <div class="clients-table__client">
        <span class="clients-table__avatar" aria-hidden="true">${escapeHtml(client.initials)}</span>
        <span class="clients-table__client-text">
          <span class="clients-table__name">${escapeHtml(client.fullName)}</span>
          ${preferred}
          ${tagsMarkup}
        </span>
      </div>`;
  }

  private renderContactCell(client: ClientListItem) {
    const phone = client.phoneDisplay;
    const email = client.emailDisplay;
    const tel = phoneHref(client.phone);
    const mail = emailHref(client.email);

    const phoneInner = phone
      ? tel
        ? `<a class="clients-table__contact-link" href="${tel}" aria-label="Call ${escapeHtml(client.fullName)}">${escapeHtml(phone)}</a>`
        : `<span class="clients-table__contact-value">${escapeHtml(phone)}</span>`
      : `<span class="clients-table__muted">${emptyContactLabel("phone")}</span>`;
    const emailInner = email
      ? mail
        ? `<a class="clients-table__contact-link" href="${mail}" aria-label="Email ${escapeHtml(client.fullName)}">${escapeHtml(email)}</a>`
        : `<span class="clients-table__contact-value">${escapeHtml(email)}</span>`
      : `<span class="clients-table__muted">${emptyContactLabel("email")}</span>`;

    return `
      <div class="clients-table__contact">
        <span class="clients-table__contact-line">
          <span class="clients-table__contact-icon" aria-hidden="true">☎</span>
          <span class="clients-page__sr-only">Phone:</span>
          ${phoneInner}
        </span>
        <span class="clients-table__contact-line">
          <span class="clients-table__contact-icon" aria-hidden="true">✉</span>
          <span class="clients-page__sr-only">Email:</span>
          ${emailInner}
        </span>
      </div>`;
  }

  private renderRowActions(client: ClientListItem) {
    const profileUrl = `${config().clientsBase}/${client.id}`;
    const bookUrl = config().bookUrl;
    const menuId = `clients-menu-${client.id}`;
    return `
      <div class="clients-table__actions" data-row-menu>
        <button type="button" class="clients-table__menu-btn" data-menu-open aria-haspopup="menu" aria-expanded="false" aria-controls="${menuId}" aria-label="Actions for ${escapeHtml(client.fullName)}">⋯</button>
        <div class="clients-table__menu" id="${menuId}" data-menu-panel hidden role="menu" aria-label="Actions for ${escapeHtml(client.fullName)}">
          <a role="menuitem" tabindex="-1" href="${profileUrl}">View profile</a>
          <a role="menuitem" tabindex="-1" href="${bookUrl}">Book appointment</a>
          <a role="menuitem" tabindex="-1" href="${profileUrl}">Edit profile</a>
          <a role="menuitem" tabindex="-1" href="${profileUrl}#client-notes-timeline">Add note</a>
          <a role="menuitem" tabindex="-1" href="${profileUrl}#client-notes">Add tag</a>
        </div>
      </div>`;
  }

  private menuItems(panel: HTMLElement) {
    return Array.from(panel.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]'));
  }

  private focusMenuItem(panel: HTMLElement, index: number) {
    const items = this.menuItems(panel);
    if (items.length === 0) return;
    const wrapped = (index + items.length) % items.length;
    items[wrapped]?.focus();
  }

  private bindRowMenu(tr: HTMLTableRowElement) {
    const menuBtn = tr.querySelector<HTMLButtonElement>("[data-menu-open]");
    const panel = tr.querySelector<HTMLElement>("[data-menu-panel]");
    if (!menuBtn || !panel) return;

    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.openMenu === panel) {
        this.closeRowMenu(true);
        return;
      }
      if (this.openMenu) this.closeRowMenu();
      this.openRowMenu(panel, menuBtn);
    });
    menuBtn.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (this.openMenu !== panel) this.openRowMenu(panel, menuBtn);
        this.focusMenuItem(panel, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (this.openMenu !== panel) this.openRowMenu(panel, menuBtn);
        this.focusMenuItem(panel, -1);
      }
    });

    const items = this.menuItems(panel);
    panel.addEventListener("keydown", (event) => {
      const current = items.indexOf(document.activeElement as HTMLAnchorElement);
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          this.focusMenuItem(panel, current + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          this.focusMenuItem(panel, current - 1);
          break;
        case "Home":
          event.preventDefault();
          this.focusMenuItem(panel, 0);
          break;
        case "End":
          event.preventDefault();
          this.focusMenuItem(panel, items.length - 1);
          break;
        case "Escape":
          event.preventDefault();
          this.closeRowMenu(true);
          break;
        case "Tab":
          this.closeRowMenu(false);
          break;
        default:
          break;
      }
    });
    panel.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => this.closeRowMenu());
    });
  }

  private openRowMenu(panel: HTMLElement, trigger: HTMLElement) {
    this.menuTrigger = trigger;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    this.openMenu = panel;
    this.positionRowMenu();
    this.repositionHandler = () => this.positionRowMenu();
    window.addEventListener("scroll", this.repositionHandler, true);
    window.addEventListener("resize", this.repositionHandler);
  }

  private positionRowMenu() {
    const panel = this.openMenu;
    const trigger = this.menuTrigger;
    if (!panel || !trigger) return;

    // Measure with panel visible but off-screen influence removed.
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 6;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Prefer right-aligned to the trigger, below it.
    let left = triggerRect.right - panelRect.width;
    if (left < margin) left = margin;
    if (left + panelRect.width > viewportW - margin) {
      left = viewportW - margin - panelRect.width;
    }

    const spaceBelow = viewportH - triggerRect.bottom;
    let top: number;
    if (spaceBelow >= panelRect.height + margin || spaceBelow >= triggerRect.top) {
      top = triggerRect.bottom + 4;
      if (top + panelRect.height > viewportH - margin) {
        top = Math.max(margin, viewportH - margin - panelRect.height);
      }
    } else {
      // Flip above the trigger.
      top = triggerRect.top - panelRect.height - 4;
      if (top < margin) top = margin;
    }

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  private closeRowMenu(restoreFocus = false) {
    if (!this.openMenu) return;
    const menu = this.openMenu;
    const trigger = this.menuTrigger;
    menu.hidden = true;
    menu.style.left = "";
    menu.style.top = "";
    trigger?.setAttribute("aria-expanded", "false");
    if (this.repositionHandler) {
      window.removeEventListener("scroll", this.repositionHandler, true);
      window.removeEventListener("resize", this.repositionHandler);
      this.repositionHandler = null;
    }
    this.menuTrigger = null;
    this.openMenu = null;
    if (restoreFocus) trigger?.focus();
  }

  private openClient(client: ClientListItem, row: HTMLElement) {
    this.closeRowMenu();
    if (DRAWER_MQ.matches) {
      this.lastFocus = row;
      void this.openDrawer(client.id);
      return;
    }
    window.location.href = `${config().clientsBase}/${client.id}`;
  }

  private bindClientRow(tr: HTMLTableRowElement, client: ClientListItem) {
    tr.className = "clients-table__row";
    tr.tabIndex = 0;
    tr.dataset.clientId = client.id;
    tr.setAttribute("role", "button");
    tr.setAttribute("aria-label", `Open ${client.fullName}`);
    tr.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement || event.target instanceof HTMLButtonElement) return;
      if (event.target instanceof Element && event.target.closest("[data-row-menu]")) return;
      this.openClient(client, tr);
    });
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.openClient(client, tr);
      }
    });
    this.bindRowMenu(tr);
  }

  private renderClientCard(client: ClientListItem) {
    const profileUrl = `${config().clientsBase}/${client.id}`;
    const contact = this.renderContactCell(client);
    const provider = client.providerName
      ? `<div class="clients-card__row"><span class="clients-card__label">Provider</span><span>${escapeHtml(client.providerName)}</span></div>`
      : "";
    const lastVisit = client.lastVisitLabel
      ? `<div class="clients-card__row"><span class="clients-card__label">Last visit</span><span>${escapeHtml(client.lastVisitLabel)}</span></div>`
      : "";
    const upcoming = client.upcomingLabel
      ? `<div class="clients-card__row clients-card__row--upcoming"><span class="clients-card__label">Next appt</span><span>${escapeHtml(client.upcomingLabel)}</span></div>`
      : "";
    const preferred = client.preferredName
      ? `<p class="clients-card__preferred">Goes by ${escapeHtml(client.preferredName)}</p>`
      : "";

    return `
      <li class="clients-card">
        <button type="button" class="clients-card__open" data-card-open="${client.id}">
          <div class="clients-card__head">
            <span class="clients-card__avatar" aria-hidden="true">${escapeHtml(client.initials)}</span>
            <div>
              <h3 class="clients-card__name">${escapeHtml(client.fullName)}</h3>
              ${preferred}
            </div>
          </div>
          <div class="clients-card__contact">${contact}</div>
          ${provider}
          <div class="clients-card__stats">${lastVisit}${upcoming}</div>
          <div class="clients-card__meta">
            <span>${client.visitCount} visits</span>
            <span title="${escapeHtml(client.ltvTitle)}">${escapeHtml(client.ltvLabel)}</span>
          </div>
        </button>
        <a class="clients-card__action clients-page__btn-secondary" href="${profileUrl}">View profile</a>
      </li>`;
  }

  private renderResults(
    clients: ClientListItem[],
    meta: {
      total: number;
      filteredTotal: number;
      filtersApplied: number;
      rangeStart: number;
      rangeEnd: number;
      totalPages: number;
      page: number;
      perPage: number;
      summary: {
        total: number;
        newThisMonth: number;
        withUpcoming: number;
        withoutUpcoming: number;
      } | null;
    },
  ) {
    const tbody = this.qs<HTMLTableSectionElement>("[data-results]");
    const cardsEl = this.qs<HTMLUListElement>("[data-card-results]");
    const emptyState = this.qs<HTMLElement>("[data-empty]");
    const resultsWrap = this.qs<HTMLElement>("[data-results-wrap]");
    const emptyTitle = this.qs<HTMLElement>("[data-empty-title]");
    const emptyHint = this.qs<HTMLElement>("[data-empty-hint]");

    this.renderFilterChips(this.buildFilterChips());
    this.updateSummary(meta.summary);
    this.updatePagination({ ...meta, filteredTotal: meta.filteredTotal });

    const resultCount = this.qs<HTMLElement>("[data-result-count]");
    if (resultCount) {
      if (meta.filteredTotal === 0) {
        resultCount.textContent = "";
        resultCount.hidden = true;
      } else {
        resultCount.hidden = false;
        resultCount.textContent =
          meta.filteredTotal === 1 ? "1 result" : `${meta.filteredTotal.toLocaleString("en-US")} results`;
      }
    }

    if (!tbody || !emptyState) return;
    tbody.innerHTML = "";

    if (clients.length === 0) {
      if (cardsEl) cardsEl.innerHTML = "";
      emptyState.hidden = false;
      resultsWrap?.classList.add("clients-page__results--empty");
      const filters = this.getFilters();
      const hasFilters = Boolean(
        filters.provider ||
          filters.tag ||
          filters.referral ||
          filters.purchased ||
          filters.hasVisits ||
          this.summaryFilter,
      );
      const term = this.getSearchTerm();
      const directoryEmpty = meta.total === 0;
      const clearBtn = this.qs<HTMLButtonElement>("[data-empty-clear]");

      if (directoryEmpty && !hasFilters && term.length < 2) {
        if (emptyTitle) emptyTitle.textContent = "No clients yet";
        if (emptyHint) emptyHint.textContent = "Add your first client to start building the directory.";
        if (clearBtn) clearBtn.hidden = true;
      } else if (hasFilters) {
        if (emptyTitle) emptyTitle.textContent = "No clients match the selected filters";
        if (emptyHint) emptyHint.textContent = "Adjust or clear the filters to see more clients.";
        if (clearBtn) clearBtn.hidden = false;
      } else if (term.length >= 2) {
        if (emptyTitle) emptyTitle.textContent = "No clients match your search";
        if (emptyHint) emptyHint.textContent = "Check spelling, or search by phone or email.";
        if (clearBtn) clearBtn.hidden = true;
      } else {
        if (emptyTitle) emptyTitle.textContent = "No clients found";
        if (emptyHint) emptyHint.textContent = "Try a different search or clear filters.";
        if (clearBtn) clearBtn.hidden = !hasFilters;
      }
      return;
    }

    emptyState.hidden = true;
    resultsWrap?.classList.remove("clients-page__results--empty");

    if (cardsEl) {
      cardsEl.innerHTML = clients.map((client) => this.renderClientCard(client)).join("");
      cardsEl.querySelectorAll<HTMLButtonElement>("[data-card-open]").forEach((btn) => {
        const id = btn.dataset.cardOpen ?? "";
        const client = clients.find((c) => c.id === id);
        if (!client) return;
        btn.addEventListener("click", () => this.openClient(client, btn));
      });
    }

    for (const client of clients) {
      const tr = document.createElement("tr");
      const providerCell = client.providerName
        ? escapeHtml(client.providerName)
        : `<span class="clients-table__soft">No provider yet</span>`;
      const lastVisitCell = client.lastVisitLabel
        ? escapeHtml(client.lastVisitLabel)
        : `<span class="clients-table__soft">No visits yet</span>`;
      const nextApptCell = client.upcomingLabel
        ? escapeHtml(client.upcomingLabel)
        : `<span class="clients-table__soft">None scheduled</span>`;

      tr.innerHTML = `
        <td data-col="client">${this.renderClientCell(client)}</td>
        <td data-col="contact">${this.renderContactCell(client)}</td>
        <td data-col="provider" class="clients-table__text">${providerCell}</td>
        <td data-col="lastVisit" class="clients-table__text">${lastVisitCell}</td>
        <td data-col="nextAppt" class="clients-table__text">${nextApptCell}</td>
        <td data-col="visits" class="clients-table__num">${client.visitCount}</td>
        <td data-col="ltv" class="clients-table__num clients-table__ltv" title="${escapeHtml(client.ltvTitle)}">${escapeHtml(client.ltvLabel)}</td>
        <td data-col="actions" class="clients-table__actions-col">${this.renderRowActions(client)}</td>
      `;
      this.bindClientRow(tr, client);
      tbody.appendChild(tr);
    }
    this.applyColumnVisibility();
  }

  private renderSkeletonRows() {
    const tbody = this.qs<HTMLTableSectionElement>("[data-results]");
    const emptyState = this.qs<HTMLElement>("[data-empty]");
    const resultsWrap = this.qs<HTMLElement>("[data-results-wrap]");
    if (!tbody) return;
    if (emptyState) emptyState.hidden = true;
    resultsWrap?.classList.remove("clients-page__results--empty");
    const cardsEl = this.qs<HTMLUListElement>("[data-card-results]");
    if (cardsEl) {
      cardsEl.innerHTML = Array.from({ length: 4 }, () =>
        `<li class="clients-card clients-card--skeleton" aria-hidden="true">
          <span class="skeleton skeleton--line" style="width:55%;height:1rem"></span>
          <span class="skeleton skeleton--line" style="width:40%"></span>
          <span class="skeleton skeleton--line" style="width:70%"></span>
        </li>`,
      ).join("");
    }
    tbody.innerHTML = Array.from({ length: 6 }, () =>
      `<tr class="clients-table__skeleton-row">
        <td><span class="skeleton skeleton--line"></span></td>
        <td><span class="skeleton skeleton--line"></span></td>
        <td><span class="skeleton skeleton--line"></span></td>
        <td><span class="skeleton skeleton--line"></span></td>
        <td><span class="skeleton skeleton--line skeleton--short"></span></td>
        <td><span class="skeleton skeleton--line skeleton--short"></span></td>
        <td><span class="skeleton skeleton--line skeleton--short"></span></td>
        <td><span class="skeleton skeleton--line skeleton--short"></span></td>
      </tr>`,
    ).join("");
  }

  async loadClients(term: string, options: { announce?: boolean } = {}) {
    // Any open row menu references a row that is about to be re-rendered;
    // close it (and detach scroll/resize listeners) before rebuilding rows.
    this.closeRowMenu();
    const query = term.trim();
    if (query.length === 1) {
      this.setSearchLoading(false);
      this.renderResults([], {
        total: 0,
        filteredTotal: 0,
        filtersApplied: 0,
        rangeStart: 0,
        rangeEnd: 0,
        totalPages: 0,
        page: 1,
        perPage: this.perPage,
        summary: null,
      });
      this.showStatus("Type at least 2 characters to search.");
      return;
    }

    this.renderSkeletonRows();
    this.setSearchLoading(true);
    this.showStatus("");

    const filters = this.getFilters();
    const params = new URLSearchParams();
    if (query.length >= 2) params.set("q", query);
    if (filters.provider) params.set("provider", filters.provider);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.referral) params.set("referral", filters.referral);
    if (filters.purchased) params.set("purchased", "1");
    if (filters.hasVisits) params.set("hasVisits", "1");
    if (this.summaryFilter === "upcoming") params.set("upcoming", "1");
    if (this.summaryFilter === "noUpcoming") params.set("noUpcoming", "1");
    params.set("sort", this.sort);
    params.set("page", String(this.page));
    params.set("perPage", String(this.perPage));

    try {
      const url = `${config().searchApi}?${params.toString()}`;
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load clients");

      const clients = (body.clients ?? []) as ClientListItem[];
      this.renderResults(clients, {
        total: body.total ?? clients.length,
        filteredTotal: body.filteredTotal ?? clients.length,
        filtersApplied: body.filtersApplied ?? 0,
        rangeStart: body.rangeStart ?? 0,
        rangeEnd: body.rangeEnd ?? clients.length,
        totalPages: body.totalPages ?? 1,
        page: body.page ?? 1,
        perPage: body.perPage ?? this.perPage,
        summary: body.summary ?? null,
      });

      if (options.announce !== false) {
        const count = body.filteredTotal ?? clients.length;
        announce(count === 1 ? "1 client found" : `${count} clients found`);
      }
      this.showStatus("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load clients";
      if (!navigator.onLine) {
        this.showStatus("You appear to be offline. Check your connection and try again.", true);
      } else {
        this.showStatus(message, true);
      }
      this.renderResults([], {
        total: 0,
        filteredTotal: 0,
        filtersApplied: 0,
        rangeStart: 0,
        rangeEnd: 0,
        totalPages: 0,
        page: 1,
        perPage: this.perPage,
        summary: null,
      });
    } finally {
      this.setSearchLoading(false);
    }
  }

  private openAddModal() {
    const modal = document.querySelector<HTMLElement>("[data-add-modal]");
    const form = document.querySelector<HTMLFormElement>("[data-add-form]");
    modal?.removeAttribute("hidden");
    if (!this.pendingForceCreate) form?.reset();
    this.hideDuplicateWarning();
    const err = document.querySelector<HTMLElement>("[data-add-error]");
    if (err) err.hidden = true;
    const submit = document.querySelector<HTMLButtonElement>("[data-add-submit]");
    if (submit) {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
      submit.textContent = this.pendingForceCreate ? "Create anyway" : "Create client";
    }
    form?.querySelector<HTMLInputElement>("input")?.focus();
  }

  private closeAddModal() {
    document.querySelector<HTMLElement>("[data-add-modal]")?.setAttribute("hidden", "");
    this.pendingForceCreate = false;
    this.hideDuplicateWarning();
  }

  private hideDuplicateWarning() {
    const box = document.querySelector<HTMLElement>("[data-add-duplicate]");
    if (box) box.hidden = true;
  }

  private showDuplicateWarning(matches: PossibleDuplicate[]) {
    const box = document.querySelector<HTMLElement>("[data-add-duplicate]");
    const list = document.querySelector<HTMLElement>("[data-duplicate-list]");
    if (!box || !list) return;
    list.innerHTML = matches
      .map((match) => {
        const href = `${config().clientsBase}/${match.id}`;
        return `<li><a href="${href}">${escapeHtml(match.fullName)}</a></li>`;
      })
      .join("");
    box.hidden = false;
    this.pendingForceCreate = true;
    const submit = document.querySelector<HTMLButtonElement>("[data-add-submit]");
    if (submit) submit.textContent = "Create anyway";
  }

  private async submitAddForm() {
    const form = document.querySelector<HTMLFormElement>("[data-add-form]");
    if (!form) return;
    const formData = new FormData(form);
    const payload = {
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      forceCreate: this.pendingForceCreate,
    };
    const err = document.querySelector<HTMLElement>("[data-add-error]");
    const submit = document.querySelector<HTMLButtonElement>("[data-add-submit]");
    if (err) err.hidden = true;
    if (submit) {
      submit.disabled = true;
      submit.setAttribute("aria-busy", "true");
      submit.textContent = "Creating…";
    }
    try {
      const res = await fetch(config().createApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (res.status === 409 && body.possibleDuplicates?.length) {
        this.showDuplicateWarning(body.possibleDuplicates as PossibleDuplicate[]);
        if (submit) {
          submit.disabled = false;
          submit.removeAttribute("aria-busy");
          submit.textContent = "Create anyway";
        }
        return;
      }
      if (!res.ok) throw new Error(body.error || "Failed to create client");

      const clientId = body.client?.id;
      this.showToast("Client created");
      if (clientId) {
        window.location.href = `${config().clientsBase}/${clientId}`;
        return;
      }
      this.closeAddModal();
      this.loadClients("");
    } catch (error) {
      if (err) {
        err.textContent = error instanceof Error ? error.message : "Failed to create client";
        err.hidden = false;
      }
      if (submit) {
        submit.disabled = false;
        submit.removeAttribute("aria-busy");
        submit.textContent = this.pendingForceCreate ? "Create anyway" : "Create client";
      }
    }
  }

  private async openDrawer(clientId: string) {
    const drawer = document.querySelector<HTMLElement>("[data-preview-drawer]");
    if (!drawer) {
      window.location.href = `${config().clientsBase}/${clientId}`;
      return;
    }

    drawer.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("clients-drawer-open");

    const loading = drawer.querySelector<HTMLElement>("[data-drawer-loading]");
    const body = drawer.querySelector<HTMLElement>("[data-drawer-body]");
    const errorEl = drawer.querySelector<HTMLElement>("[data-drawer-error]");
    if (loading) loading.hidden = false;
    if (body) body.hidden = true;
    if (errorEl) errorEl.hidden = true;

    try {
      const response = await fetch(config().clientApi.replace(":id", clientId));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load client");

      const client = data.client;
      const visits = data.visitTimeline ?? [];
      const notes = data.notes ?? [];

      drawer.querySelector<HTMLElement>("[data-drawer-avatar]")!.textContent = client.fullName
        ?.split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() ?? "?";
      drawer.querySelector<HTMLElement>("[data-drawer-name]")!.textContent = client.fullName;

      const preferred = drawer.querySelector<HTMLElement>("[data-drawer-preferred]");
      if (preferred) {
        const pref = client.bookingPreferences?.match(/^goes by\s+(.+)$/i)?.[1];
        if (pref) {
          preferred.textContent = `Goes by ${pref}`;
          preferred.hidden = false;
        } else {
          preferred.hidden = true;
        }
      }

      const contactParts: string[] = [];
      if (client.phone) contactParts.push(client.phone);
      if (client.email) contactParts.push(client.email);
      drawer.querySelector<HTMLElement>("[data-drawer-contact]")!.textContent =
        contactParts.join(" · ") || "No contact on file";

      const upcoming = visits.find(
        (v: { startsAt: string; status: string }) =>
          new Date(v.startsAt) >= new Date() &&
          ["booked", "confirmed", "pending", "arrived"].includes(v.status),
      );
      drawer.querySelector<HTMLElement>("[data-drawer-upcoming]")!.textContent = upcoming
        ? `${upcoming.timeLabel ?? ""}${upcoming.staffName ? ` · ${upcoming.staffName}` : ""}`.trim()
        : "None scheduled";
      drawer.querySelector<HTMLElement>("[data-drawer-last-visit]")!.textContent = client.lastVisitAt
        ? new Date(client.lastVisitAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";
      drawer.querySelector<HTMLElement>("[data-drawer-provider]")!.textContent =
        upcoming?.staffName ?? visits[0]?.staffName ?? "—";
      drawer.querySelector<HTMLElement>("[data-drawer-visits]")!.textContent = String(client.visitCount ?? 0);
      const ltv = (client.lifetimeValueCents ?? 0) / 100;
      drawer.querySelector<HTMLElement>("[data-drawer-ltv]")!.textContent =
        ltv > 0 ? `$${Math.round(ltv)}` : client.visitCount > 0 ? "$0" : "No sales yet";

      const tagsWrap = drawer.querySelector<HTMLElement>("[data-drawer-tags-wrap]");
      const tagsList = drawer.querySelector<HTMLElement>("[data-drawer-tags]");
      const tags = client.tags ?? [];
      if (tagsWrap && tagsList) {
        if (tags.length > 0) {
          tagsWrap.hidden = false;
          tagsList.innerHTML = tags.map((tag: string) => `<li>${escapeHtml(tag)}</li>`).join("");
        } else {
          tagsWrap.hidden = true;
        }
      }

      const timelineWrap = drawer.querySelector<HTMLElement>("[data-drawer-visits-wrap]");
      const timeline = drawer.querySelector<HTMLElement>("[data-drawer-timeline]");
      if (timelineWrap && timeline) {
        const recent = visits.slice(0, 3);
        if (recent.length > 0) {
          timelineWrap.hidden = false;
          timeline.innerHTML = recent
            .map(
              (visit: { timeLabel: string; serviceNames: string[]; staffName: string }) =>
                `<li><strong>${escapeHtml(visit.timeLabel)}</strong> — ${escapeHtml(
                  visit.serviceNames?.join(", ") || "Appointment",
                )} <span class="clients-drawer__muted">${escapeHtml(visit.staffName)}</span></li>`,
            )
            .join("");
        } else {
          timelineWrap.hidden = true;
        }
      }

      const notesWrap = drawer.querySelector<HTMLElement>("[data-drawer-notes-wrap]");
      const notesList = drawer.querySelector<HTMLElement>("[data-drawer-notes]");
      if (notesWrap && notesList) {
        const recentNotes = notes.slice(0, 2);
        if (recentNotes.length > 0) {
          notesWrap.hidden = false;
          notesList.innerHTML = recentNotes
            .map(
              (note: { body: string; staffName: string }) =>
                `<li>${escapeHtml(note.body)} <span class="clients-drawer__muted">— ${escapeHtml(note.staffName)}</span></li>`,
            )
            .join("");
        } else {
          notesWrap.hidden = true;
        }
      }

      const profileLink = drawer.querySelector<HTMLAnchorElement>("[data-drawer-profile]");
      const bookLink = drawer.querySelector<HTMLAnchorElement>("[data-drawer-book]");
      if (profileLink) profileLink.href = `${config().clientsBase}/${clientId}`;
      if (bookLink) bookLink.href = config().bookUrl;

      if (loading) loading.hidden = true;
      if (body) body.hidden = false;
      drawer.querySelector<HTMLButtonElement>("[data-drawer-close]")?.focus();
    } catch (error) {
      if (loading) loading.hidden = true;
      if (errorEl) {
        errorEl.textContent = error instanceof Error ? error.message : "Failed to load client";
        errorEl.hidden = false;
      }
    }
  }

  private closeDrawer() {
    const drawer = document.querySelector<HTMLElement>("[data-preview-drawer]");
    if (!drawer) return;
    drawer.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("clients-drawer-open");
    this.lastFocus?.focus();
    this.lastFocus = null;
  }
}

function boot() {
  const root = document.querySelector<HTMLElement>("[data-clients-root]");
  if (!root || !window.__clientsDirectoryConfig) return;
  new ClientsDirectory(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
