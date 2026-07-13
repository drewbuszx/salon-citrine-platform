type AuditItem = {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string | null;
  targetName: string | null;
  detail: string | null;
  createdAt: string;
};

const root = document.querySelector<HTMLElement>("[data-manage-audit]");

if (root) {
  const apiBase = root.dataset.apiBase ?? "";
  const filters = root.querySelector<HTMLFormElement>("[data-audit-filters]");
  const actionEl = root.querySelector<HTMLSelectElement>("[data-audit-action]");
  const employeeEl = root.querySelector<HTMLSelectElement>("[data-audit-employee]");
  const fromEl = root.querySelector<HTMLInputElement>("[data-audit-from]");
  const toEl = root.querySelector<HTMLInputElement>("[data-audit-to]");
  const list = root.querySelector<HTMLOListElement>("[data-audit-list]");
  const tpl = root.querySelector<HTMLTemplateElement>("[data-audit-row-template]");
  const loadingEl = root.querySelector<HTMLElement>("[data-audit-loading]");
  const emptyEl = root.querySelector<HTMLElement>("[data-audit-empty]");
  const errorEl = root.querySelector<HTMLElement>("[data-audit-error]");

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Indiana/Indianapolis",
  });

  const relativeFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  function formatRelativeTime(iso: string) {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diffSec = Math.round((then - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 60) return "just now";
    if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return relativeFmt.format(Math.round(diffSec / 3600), "hour");
    if (abs < 86400 * 14) return relativeFmt.format(Math.round(diffSec / 86400), "day");
    return dateFmt.format(new Date(iso));
  }

  const show = (el: HTMLElement | null, visible: boolean) => {
    if (el) el.hidden = !visible;
  };

  function filtersActive() {
    return Boolean(
      actionEl?.value || employeeEl?.value || fromEl?.value || toEl?.value,
    );
  }

  let reqId = 0;

  async function load() {
    if (!list || !tpl) return;
    const current = ++reqId;
    show(loadingEl, true);
    show(errorEl, false);
    show(emptyEl, false);
    show(list, false);
    if (errorEl) errorEl.textContent = "";

    const params = new URLSearchParams();
    if (actionEl?.value) params.set("action", actionEl.value);
    if (employeeEl?.value) params.set("employee", employeeEl.value);
    if (fromEl?.value) params.set("from", fromEl.value);
    if (toEl?.value) params.set("to", toEl.value);
    const qs = params.toString();

    try {
      const res = await fetch(qs ? `${apiBase}?${qs}` : apiBase, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (current !== reqId) return;
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = (await res.json()) as { entries?: AuditItem[] };
      if (current !== reqId) return;

      const entries = body.entries ?? [];
      list.replaceChildren();

      if (entries.length === 0) {
        if (emptyEl) {
          emptyEl.textContent = filtersActive()
            ? "No activity matches these filters. Try widening the date range or clearing filters."
            : "Invites, role changes, and access actions will show up here as your team uses Manage.";
        }
        show(loadingEl, false);
        show(emptyEl, true);
        return;
      }

      const template = tpl.content.firstElementChild;
      if (!template) return;

      for (const entry of entries) {
        const node = template.cloneNode(true) as HTMLElement;
        const set = (selector: string, text: string) => {
          const el = node.querySelector<HTMLElement>(selector);
          if (el) el.textContent = text;
        };
        const actor = entry.actorName ?? "System";
        const target = entry.targetName ?? "someone";
        set("[data-row-action]", entry.actionLabel);
        set("[data-row-who]", `${actor} → ${target}`);
        set("[data-row-detail]", entry.detail ?? "");
        const timeEl = node.querySelector<HTMLTimeElement>("[data-row-time]");
        if (timeEl) {
          timeEl.dateTime = entry.createdAt;
          timeEl.textContent = formatRelativeTime(entry.createdAt);
          timeEl.title = dateFmt.format(new Date(entry.createdAt));
        }
        list.appendChild(node);
      }

      show(loadingEl, false);
      show(list, true);
    } catch (err) {
      if (current !== reqId) return;
      console.error(err);
      show(loadingEl, false);
      if (errorEl) errorEl.textContent = "Failed to load activity. Try again.";
      show(errorEl, true);
    }
  }

  filters?.addEventListener("submit", (event) => {
    event.preventDefault();
    void load();
  });

  root.querySelector("[data-audit-reset]")?.addEventListener("click", () => {
    if (actionEl) actionEl.value = "";
    if (employeeEl) employeeEl.value = "";
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";
    void load();
  });

  void load();
}

export {};
