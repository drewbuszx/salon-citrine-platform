type StaffMember = { id: string; name: string };

const MOBILE_MQ = "(max-width: 48rem)";
const TABLET_MQ = "(min-width: 48rem) and (max-width: 64rem)";
const TABLET_LANDSCAPE_MQ =
  "(min-width: 48rem) and (max-width: 64rem) and (orientation: landscape)";
const STORAGE_KEY = "team-book-mobile-staff";

export function initDayCalendarMobile(
  root: HTMLElement,
  staff: StaffMember[],
  currentStaffId: string,
  compactDateLabel: string,
) {
  let mobileIndex = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let gridScrollSyncLock = false;

  const bar = root.querySelector<HTMLElement>("[data-mobile-staff-bar]");
  const select = root.querySelector<HTMLSelectElement>("[data-mobile-staff-select]");
  const prevBtn = root.querySelector<HTMLButtonElement>("[data-mobile-staff-prev]");
  const nextBtn = root.querySelector<HTMLButtonElement>("[data-mobile-staff-next]");
  const compactSubbar = root.querySelector<HTMLElement>("[data-compact-subbar]");
  const compactStaff = root.querySelector<HTMLElement>("[data-compact-staff]");
  const compactDate = root.querySelector<HTMLElement>("[data-compact-date]");
  const viewport = root.querySelector<HTMLElement>("[data-calendar-viewport]");
  const header = root.querySelector<HTMLElement>("[data-sticky-header]");
  const staffFilter = root.querySelector<HTMLElement>("[data-staff-filter]");
  const schedule = root.querySelector<HTMLElement>("[data-staff-columns]");
  const mq = window.matchMedia(MOBILE_MQ);
  const tabletMq = window.matchMedia(TABLET_MQ);
  const tabletLandscapeMq = window.matchMedia(TABLET_LANDSCAPE_MQ);

  if (!viewport) {
    return { refreshMobileStaff: () => {} };
  }

  if (compactDate) compactDate.textContent = compactDateLabel;

  if (select && select.options.length === 0) {
    for (const member of staff) {
      const opt = document.createElement("option");
      opt.value = member.id;
      opt.textContent = member.name;
      select.appendChild(opt);
    }
  }

  function usesCompactToolbar(): boolean {
    return mq.matches || tabletLandscapeMq.matches;
  }

  function usesMultiColumnGrid(): boolean {
    return !mq.matches;
  }

  function scrollStaffChipIntoView(staffId: string, behavior: ScrollBehavior = "smooth") {
    const chip = root.querySelector<HTMLElement>(`[data-staff-filter-id="${staffId}"]`);
    chip?.scrollIntoView({ behavior, inline: "center", block: "nearest" });
  }

  function scrollGridToStaffColumn(staffId: string, behavior: ScrollBehavior = "smooth") {
    const column = root.querySelector<HTMLElement>(
      `[data-staff-column="${staffId}"]:not([hidden])`,
    );
    if (!(column instanceof HTMLElement) || !(schedule instanceof HTMLElement)) return;

    const timeAxis = root.querySelector<HTMLElement>(".day-cal__time-axis");
    const axisWidth = timeAxis?.getBoundingClientRect().width ?? 0;
    const scheduleLeft = schedule.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
    const targetLeft = column.offsetLeft + scheduleLeft - axisWidth - 4;

    gridScrollSyncLock = true;
    viewport.scrollTo({ left: Math.max(0, targetLeft), behavior });
    window.setTimeout(() => {
      gridScrollSyncLock = false;
    }, behavior === "smooth" ? 320 : 0);
  }

  function syncStaffChipFromGridScroll() {
    if (gridScrollSyncLock || !usesMultiColumnGrid() || !(staffFilter instanceof HTMLElement)) {
      return;
    }

    const columns = visibleColumns();
    if (columns.length <= 1) return;

    const viewportRect = viewport.getBoundingClientRect();
    const axisWidth =
      root.querySelector<HTMLElement>(".day-cal__time-axis")?.getBoundingClientRect().width ??
      0;
    const scanLeft = viewportRect.left + axisWidth + 8;

    let leadColumn = columns[0];
    for (const column of columns) {
      const rect = column.getBoundingClientRect();
      if (rect.right > scanLeft) {
        leadColumn = column;
        break;
      }
    }

    const staffId = leadColumn.dataset.staffColumn ?? "";
    if (!staffId) return;

    root.querySelectorAll<HTMLElement>("[data-staff-filter-id]").forEach((chip) => {
      chip.classList.toggle(
        "day-cal__staff-chip--in-view",
        chip.dataset.staffFilterId === staffId,
      );
    });

    scrollStaffChipIntoView(staffId, "auto");
  }

  function initGridChipScrollSync() {
    if (!(staffFilter instanceof HTMLElement)) return;

    viewport.addEventListener(
      "scroll",
      () => {
        syncStaffChipFromGridScroll();
      },
      { passive: true },
    );

    root.querySelectorAll<HTMLElement>("[data-staff-filter-id]").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (!usesMultiColumnGrid()) return;
        const staffId = chip.dataset.staffFilterId ?? "";
        if (!staffId || chip.getAttribute("aria-pressed") === "false") return;
        window.requestAnimationFrame(() => scrollGridToStaffColumn(staffId));
      });
    });

    root.querySelector<HTMLElement>("[data-staff-filter-all]")?.addEventListener("click", () => {
      if (!usesMultiColumnGrid()) return;
      window.requestAnimationFrame(() => {
        gridScrollSyncLock = true;
        viewport.scrollTo({ left: 0, behavior: "smooth" });
        window.setTimeout(() => {
          gridScrollSyncLock = false;
        }, 320);
      });
    });
  }

  function visibleColumns(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>("[data-staff-column]")).filter(
      (col) => !col.hidden,
    );
  }

  function visibleStaffIds(): string[] {
    return visibleColumns()
      .map((col) => col.dataset.staffColumn ?? "")
      .filter(Boolean);
  }

  function setMobileColumnCount() {
    const columns = root.querySelector<HTMLElement>("[data-staff-columns]");
    if (columns && mq.matches) {
      columns.style.setProperty("--day-staff-count", "1");
    }
  }

  function applyMobileStaffIndex(targetIndex: number) {
    if (!mq.matches) {
      root.querySelectorAll<HTMLElement>("[data-staff-column]").forEach((col) => {
        col.classList.remove("is-mobile-active");
      });
      root
        .querySelectorAll<HTMLElement>("[data-staff-header-column]")
        .forEach((col) => {
          col.classList.remove("is-mobile-active");
        });
      root.classList.remove("day-cal--mobile-single");
      if (bar) bar.hidden = true;
      compactSubbar?.classList.remove("is-visible");
      header?.classList.remove("is-compact");
      root.classList.remove("day-cal--compact-toolbar");
      return;
    }

    const cols = visibleColumns();
    if (!cols.length) return;

    root.classList.add("day-cal--mobile-single");
    mobileIndex = ((targetIndex % cols.length) + cols.length) % cols.length;
    const activeCol = cols[mobileIndex];
    const activeId = activeCol?.dataset.staffColumn ?? "";

    root.querySelectorAll<HTMLElement>("[data-staff-column]").forEach((col) => {
      col.classList.toggle("is-mobile-active", col === activeCol);
    });
    root
      .querySelectorAll<HTMLElement>("[data-staff-header-column]")
      .forEach((headerCol) => {
        const headerId = headerCol.dataset.staffHeaderColumn ?? "";
        headerCol.classList.toggle("is-mobile-active", headerId === activeId);
      });

    if (select && select.value !== activeId) select.value = activeId;
    const member = staff.find((s) => s.id === activeId);
    if (compactStaff) compactStaff.textContent = member?.name ?? "";
    try {
      sessionStorage.setItem(STORAGE_KEY, activeId);
    } catch {
      /* ignore */
    }
    setMobileColumnCount();
    if (bar) bar.hidden = cols.length <= 1;
  }

  function resolveInitialIndex(): number {
    const ids = visibleStaffIds();
    if (!ids.length) return 0;
    let preferred = currentStaffId;
    try {
      preferred = sessionStorage.getItem(STORAGE_KEY) ?? currentStaffId;
    } catch {
      /* ignore */
    }
    const idx = ids.indexOf(preferred);
    return idx >= 0 ? idx : 0;
  }

  function refreshMobileStaff() {
    if (!mq.matches) {
      applyMobileStaffIndex(0);
      return;
    }
    const ids = visibleStaffIds();
    let idx = -1;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) idx = ids.indexOf(stored);
    } catch {
      /* ignore */
    }
    if (idx < 0) idx = resolveInitialIndex();
    applyMobileStaffIndex(idx);
  }

  select?.addEventListener("change", () => {
    const idx = visibleStaffIds().indexOf(select.value);
    if (idx >= 0) applyMobileStaffIndex(idx);
  });

  prevBtn?.addEventListener("click", () => applyMobileStaffIndex(mobileIndex - 1));
  nextBtn?.addEventListener("click", () => applyMobileStaffIndex(mobileIndex + 1));

  viewport.addEventListener(
    "touchstart",
    (event) => {
      if (!mq.matches || event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    },
    { passive: true },
  );

  viewport.addEventListener(
    "touchend",
    (event) => {
      if (!mq.matches || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touchStartX;
      const dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) applyMobileStaffIndex(mobileIndex - 1);
      else applyMobileStaffIndex(mobileIndex + 1);
    },
    { passive: true },
  );

  const compactThreshold = 72;
  viewport.addEventListener(
    "scroll",
    () => {
      if (!usesCompactToolbar()) {
        compactSubbar?.classList.remove("is-visible");
        header?.classList.remove("is-compact");
        root.classList.remove("day-cal--compact-toolbar");
        return;
      }
      const scrolled = viewport.scrollTop > compactThreshold;
      compactSubbar?.classList.toggle("is-visible", scrolled);
      header?.classList.toggle("is-compact", scrolled);
      root.classList.toggle("day-cal--compact-toolbar", scrolled);
    },
    { passive: true },
  );

  function refreshResponsiveLayout() {
    refreshMobileStaff();
    root.classList.toggle("day-cal--tablet", tabletMq.matches);
    root.classList.toggle("day-cal--tablet-landscape", tabletLandscapeMq.matches);
    if (usesMultiColumnGrid()) {
      syncStaffChipFromGridScroll();
    }
  }

  initGridChipScrollSync();
  mq.addEventListener("change", refreshResponsiveLayout);
  tabletMq.addEventListener("change", refreshResponsiveLayout);
  tabletLandscapeMq.addEventListener("change", refreshResponsiveLayout);
  refreshResponsiveLayout();

  return { refreshMobileStaff: refreshResponsiveLayout };
}

function attachMobileApi(root: HTMLElement) {
  const configEl = document.getElementById("day-cal-config");
  if (!configEl) return;

  let config: {
    staff?: StaffMember[];
    currentStaffId?: string;
    dayLabel?: string;
  };
  try {
    config = JSON.parse(configEl.textContent || "{}");
  } catch {
    return;
  }

  if (root.dataset.mobileStaffInit === "true") {
    (
      root as HTMLElement & { __teamMobileStaffRefresh?: () => void }
    ).__teamMobileStaffRefresh?.();
    return;
  }
  root.dataset.mobileStaffInit = "true";

  const api = initDayCalendarMobile(
    root,
    config.staff ?? [],
    config.currentStaffId ?? "",
    config.dayLabel ?? "",
  );
  (
    root as HTMLElement & { __teamMobileStaffRefresh?: () => void }
  ).__teamMobileStaffRefresh = api.refreshMobileStaff;
  api.refreshMobileStaff();
}

function bootstrapDayCalendarMobile() {
  const root = document.querySelector<HTMLElement>(".day-cal");
  if (!root) return;
  attachMobileApi(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapDayCalendarMobile);
} else {
  bootstrapDayCalendarMobile();
}

document.addEventListener("team:day-cal-ready", () => {
  const root = document.querySelector<HTMLElement>(".day-cal");
  if (root) attachMobileApi(root);
});

document.addEventListener("team:staff-columns-changed", () => {
  const root = document.querySelector<HTMLElement>(".day-cal");
  root?.__teamMobileStaffRefresh?.();
});
