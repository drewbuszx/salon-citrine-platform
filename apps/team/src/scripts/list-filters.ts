/**
 * Mobile filter sheet, active chips, and session persistence for TeamListLayout.
 */

const SHEET_MQ = window.matchMedia("(max-width: 900px)");
const STORAGE_PREFIX = "team-filters:";

type FilterChip = {
  id: string;
  label: string;
  clear: () => void;
};

function inputKey(input: HTMLInputElement) {
  return (
    input.name ||
    input.id ||
    Object.entries(input.dataset)
      .filter(([key]) => key.startsWith("filter"))
      .map(([key, value]) => `${key}=${value}`)
      .join("&") ||
    input.type
  );
}

function labelForInput(input: HTMLInputElement) {
  const optionLabel = input.closest("label")?.querySelector("span")?.textContent?.trim();
  if (optionLabel) return optionLabel;
  const fieldLabel = input
    .closest(".reports-sidebar__field, .team-list-layout__filter-option")
    ?.querySelector(".reports-sidebar__label, span")
    ?.textContent?.trim();
  return fieldLabel || input.value || "Filter";
}

function groupLabelForInput(input: Element) {
  return (
    input
      .closest(".team-list-layout__filter, .reports-sidebar")
      ?.querySelector(".team-list-layout__filter-label, .team-list-layout__sidebar-title")
      ?.textContent?.trim() ?? ""
  );
}

export function collectActiveFilterChips(sidebar: HTMLElement): FilterChip[] {
  const chips: FilterChip[] = [];
  const seenRadios = new Set<string>();

  sidebar.querySelectorAll<HTMLInputElement>("input[type='radio']:checked").forEach((radio) => {
    if (!radio.name || seenRadios.has(radio.name)) return;
    seenRadios.add(radio.name);
    const value = radio.value.trim();
    if (!value) return;
    const option = labelForInput(radio);
    const group = groupLabelForInput(radio);
    chips.push({
      id: `radio:${radio.name}:${value}`,
      label: group ? `${group}: ${option}` : option,
      clear: () => {
        const fallback =
          sidebar.querySelector<HTMLInputElement>(
            `input[type='radio'][name="${CSS.escape(radio.name)}"][value=""]`,
          ) ??
          sidebar.querySelector<HTMLInputElement>(
            `input[type='radio'][name="${CSS.escape(radio.name)}"]`,
          );
        if (fallback) {
          fallback.checked = true;
          fallback.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
    });
  });

  sidebar.querySelectorAll<HTMLInputElement>("input[type='checkbox']:checked").forEach((checkbox) => {
    const label = labelForInput(checkbox);
    chips.push({
      id: `checkbox:${inputKey(checkbox)}`,
      label,
      clear: () => {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });
  });

  sidebar
    .querySelectorAll<HTMLInputElement>(
      "input[type='number'], input[type='date'], input[type='text']:not(.team-list-layout__filter-search)",
    )
    .forEach((input) => {
      if (!input.value.trim()) return;
      if (input.closest(".team-list-layout__search")) return;
      const group = groupLabelForInput(input);
      const field = labelForInput(input);
      chips.push({
        id: `value:${inputKey(input)}`,
        label: group ? `${group}: ${field} ${input.value}` : `${field} ${input.value}`,
        clear: () => {
          input.value = "";
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("input", { bubbles: true }));
        },
      });
    });

  sidebar.querySelectorAll<HTMLButtonElement>(".team-list-layout__sidebar-nav-btn.is-active").forEach((btn) => {
    const category = btn.dataset.docCategory;
    if (!category || category === "all") return;
    const label = btn.textContent?.trim() || category;
    chips.push({
      id: `nav:${category}`,
      label: `Category: ${label}`,
      clear: () => {
        const allBtn = sidebar.querySelector<HTMLButtonElement>(
          ".team-list-layout__sidebar-nav-btn[data-doc-category='all']",
        );
        allBtn?.click();
      },
    });
  });

  return chips;
}

function serializeFilters(sidebar: HTMLElement) {
  const state: Record<string, string | boolean> = {};
  sidebar.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    const key = inputKey(input);
    if (input.type === "checkbox") {
      if (input.checked) state[key] = true;
    } else if (input.type === "radio") {
      if (input.checked) state[`radio:${input.name}`] = input.value;
    } else if (input.value.trim()) {
      state[key] = input.value;
    }
  });
  sidebar.querySelectorAll<HTMLButtonElement>(".team-list-layout__sidebar-nav-btn.is-active").forEach((btn) => {
    if (btn.dataset.docCategory) {
      state["docCategory"] = btn.dataset.docCategory;
    }
  });
  return state;
}

function restoreFilters(sidebar: HTMLElement, state: Record<string, string | boolean>) {
  Object.entries(state).forEach(([key, value]) => {
    if (key === "docCategory" && typeof value === "string") {
      const btn = sidebar.querySelector<HTMLButtonElement>(
        `.team-list-layout__sidebar-nav-btn[data-doc-category='${CSS.escape(value)}']`,
      );
      btn?.click();
      return;
    }
    if (key.startsWith("radio:")) {
      const name = key.slice(6);
      const radio = sidebar.querySelector<HTMLInputElement>(
        `input[type='radio'][name='${CSS.escape(name)}'][value='${CSS.escape(String(value))}']`,
      );
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    const input = sidebar.querySelector<HTMLInputElement>(
      `input[name='${CSS.escape(key)}'], input[id='${CSS.escape(key)}']`,
    );
    if (input) {
      if (input.type === "checkbox") {
        input.checked = value === true;
      } else {
        input.value = String(value);
      }
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

function renderChips(
  sidebar: HTMLElement,
  chipsEl: HTMLElement | null,
  badgeEl: HTMLElement | null,
  statsCountEl: HTMLElement | null,
) {
  const chips = collectActiveFilterChips(sidebar);
  const count = chips.length;

  if (badgeEl) {
    badgeEl.textContent = String(count);
    badgeEl.hidden = count === 0;
  }
  if (statsCountEl) {
    statsCountEl.textContent = String(count);
  }

  if (!chipsEl) return;
  chipsEl.replaceChildren();
  chips.forEach((chip) => {
    const el = document.createElement("span");
    el.className = "ui-filter-chip team-list-layout__filter-chip";
    const label = document.createElement("span");
    label.className = "ui-filter-chip__label";
    label.textContent = chip.label;
    el.append(label);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ui-filter-chip__remove";
    remove.setAttribute("aria-label", `Remove filter: ${chip.label}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      chip.clear();
    });
    el.appendChild(remove);
    chipsEl.appendChild(el);
  });
}

function enhanceScrollableFilters(sidebar: HTMLElement) {
  sidebar
    .querySelectorAll<HTMLElement>(".team-list-layout__filter-options--scroll")
    .forEach((container) => {
      if (container.dataset.searchEnhanced === "1") return;
      const options = container.querySelectorAll<HTMLElement>(".team-list-layout__filter-option");
      if (options.length < 6) return;
      container.dataset.searchEnhanced = "1";

      const search = document.createElement("input");
      search.type = "search";
      search.className = "team-list-layout__filter-search inventory-form-input";
      search.placeholder = "Search list";
      search.setAttribute("aria-label", "Search filter options");
      container.parentElement?.insertBefore(search, container);

      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        options.forEach((option) => {
          const text = option.textContent?.toLowerCase() ?? "";
          option.hidden = query.length > 0 && !text.includes(query);
        });
      });
    });
}

function expandFilterSections(sidebar: HTMLElement) {
  sidebar.querySelectorAll<HTMLDetailsElement>(".team-list-layout__filter").forEach((details) => {
    details.open = true;
  });
}

export function initListFilters(layout: HTMLElement) {
  const sidebar = layout.querySelector<HTMLElement>("[data-filter-panel]");
  if (!sidebar) return;
  if (layout.dataset.listFiltersReady === "1") return;
  layout.dataset.listFiltersReady = "1";

  const backdrop = layout.querySelector<HTMLElement>("[data-filter-backdrop]");
  const openBtn = layout.querySelector<HTMLButtonElement>("[data-filter-open]");
  const closeBtn = layout.querySelector<HTMLButtonElement>("[data-filter-close]");
  const chipsEl = layout.querySelector<HTMLElement>("[data-filter-chips]");
  const badgeEl = layout.querySelector<HTMLElement>("[data-filter-badge]");
  const statsCountEl = layout.querySelector("[data-filter-count]");

  const storageKey =
    STORAGE_PREFIX + (layout.dataset.filterKey || location.pathname + location.search);

  function saveFilters() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(serializeFilters(sidebar!)));
    } catch {
      /* ignore */
    }
  }

  function loadFilters() {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const state = JSON.parse(raw) as Record<string, string | boolean>;
      restoreFilters(sidebar!, state);
    } catch {
      /* ignore */
    }
  }

  function refreshUI() {
    renderChips(sidebar!, chipsEl, badgeEl, statsCountEl as HTMLElement | null);
    saveFilters();
    layout.dispatchEvent(new CustomEvent("team-filters-change", { bubbles: true }));
  }

  function openSheet() {
    if (!SHEET_MQ.matches) return;
    layout.classList.add("is-filter-open");
    sidebar!.classList.add("is-sheet-open");
    sidebar!.removeAttribute("inert");
    backdrop?.removeAttribute("hidden");
    openBtn?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("team-filter-sheet-open");
    expandFilterSections(sidebar!);
    enhanceScrollableFilters(sidebar!);
    closeBtn?.focus();
  }

  function closeSheet() {
    layout.classList.remove("is-filter-open");
    sidebar!.classList.remove("is-sheet-open");
    if (SHEET_MQ.matches) {
      sidebar!.setAttribute("inert", "");
    }
    backdrop?.setAttribute("hidden", "");
    openBtn?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("team-filter-sheet-open");
    openBtn?.focus();
  }

  function applyLayoutMode() {
    if (SHEET_MQ.matches) {
      sidebar!.setAttribute("inert", "");
    } else {
      closeSheet();
      sidebar!.removeAttribute("inert");
    }
    refreshUI();
  }

  openBtn?.addEventListener("click", () => {
    if (layout.classList.contains("is-filter-open")) closeSheet();
    else openSheet();
  });
  closeBtn?.addEventListener("click", closeSheet);
  backdrop?.addEventListener("click", closeSheet);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && layout.classList.contains("is-filter-open")) {
      event.preventDefault();
      closeSheet();
    }
  });

  sidebar.addEventListener("change", refreshUI);
  sidebar.addEventListener("input", refreshUI);

  function bootstrapFilters() {
    loadFilters();
    applyLayoutMode();
    refreshUI();
    layout.dispatchEvent(new CustomEvent("team-filters-restored", { bubbles: true }));
  }

  queueMicrotask(bootstrapFilters);
  SHEET_MQ.addEventListener("change", applyLayoutMode);
}

export function initAllListFilters() {
  document.querySelectorAll<HTMLElement>(".team-list-layout[data-list-filters]").forEach((layout) => {
    initListFilters(layout);
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllListFilters);
  } else {
    initAllListFilters();
  }
  document.addEventListener("astro:page-load", initAllListFilters);
}
