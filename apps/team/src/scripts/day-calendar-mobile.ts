type StaffMember = { id: string; name: string };

const MOBILE_MQ = "(max-width: 48rem)";
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

  const bar = root.querySelector<HTMLElement>("[data-mobile-staff-bar]");
  const select = root.querySelector<HTMLSelectElement>("[data-mobile-staff-select]");
  const prevBtn = root.querySelector<HTMLButtonElement>("[data-mobile-staff-prev]");
  const nextBtn = root.querySelector<HTMLButtonElement>("[data-mobile-staff-next]");
  const compactSubbar = root.querySelector<HTMLElement>("[data-compact-subbar]");
  const compactStaff = root.querySelector<HTMLElement>("[data-compact-staff]");
  const compactDate = root.querySelector<HTMLElement>("[data-compact-date]");
  const viewport = root.querySelector<HTMLElement>("[data-calendar-viewport]");
  const header = root.querySelector<HTMLElement>("[data-sticky-header]");
  const mq = window.matchMedia(MOBILE_MQ);

  if (!bar || !select || !viewport) {
    return { refreshMobileStaff: () => {} };
  }

  if (compactDate) compactDate.textContent = compactDateLabel;

  if (select.options.length === 0) {
    for (const member of staff) {
      const opt = document.createElement("option");
      opt.value = member.id;
      opt.textContent = member.name;
      select.appendChild(opt);
    }
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
      bar.hidden = true;
      compactSubbar?.classList.remove("is-visible");
      header?.classList.remove("is-compact");
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

    if (select.value !== activeId) select.value = activeId;
    const member = staff.find((s) => s.id === activeId);
    if (compactStaff) compactStaff.textContent = member?.name ?? "";
    try {
      sessionStorage.setItem(STORAGE_KEY, activeId);
    } catch {
      /* ignore */
    }
    setMobileColumnCount();
    bar.hidden = cols.length <= 1;
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

  select.addEventListener("change", () => {
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
      if (!mq.matches) {
        compactSubbar?.classList.remove("is-visible");
        header?.classList.remove("is-compact");
        return;
      }
      const scrolled = viewport.scrollTop > compactThreshold;
      compactSubbar?.classList.toggle("is-visible", scrolled);
      header?.classList.toggle("is-compact", scrolled);
    },
    { passive: true },
  );

  mq.addEventListener("change", refreshMobileStaff);
  refreshMobileStaff();

  return { refreshMobileStaff };
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
