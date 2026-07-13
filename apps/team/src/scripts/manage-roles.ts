import { confirmDestructive } from "../lib/confirm-destructive";

const root = document.querySelector<HTMLElement>("[data-manage-roles]");

if (root) {
  const apiBase = root.dataset.apiBase ?? "";
  const successEl = root.querySelector<HTMLElement>("[data-roles-success]");
  const errorEl = root.querySelector<HTMLElement>("[data-roles-error]");

  const show = (el: HTMLElement | null, visible: boolean) => {
    if (el) el.hidden = !visible;
  };

  const toggles = root.querySelectorAll<HTMLInputElement>("[data-role-toggle]");

  toggles.forEach((input) => {
    input.addEventListener("change", async () => {
      const role = input.dataset.role ?? "";
      const capability = input.dataset.capability ?? "";
      const enabled = input.checked;

      if (!enabled) {
        const confirmed = await confirmDestructive({
          title: "Remove this permission?",
          body: `People with the ${role.replaceAll("_", " ")} role will lose “${capability.replaceAll("_", " ")}” immediately.`,
          confirmLabel: "Remove permission",
          cancelLabel: "Keep permission",
        });
        if (!confirmed) {
          input.checked = true;
          return;
        }
      }

      input.disabled = true;
      show(successEl, false);
      show(errorEl, false);

      try {
        const res = await fetch(apiBase, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ role, capability, enabled }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data?.error || `Request failed (${res.status})`);
        }
        if (successEl) {
          successEl.textContent = enabled ? "Permission granted." : "Permission removed.";
        }
        show(successEl, true);
      } catch (err) {
        input.checked = !enabled;
        if (errorEl) {
          errorEl.textContent =
            err instanceof Error ? err.message : "Could not update permission.";
        }
        show(errorEl, true);
      } finally {
        input.disabled = false;
      }
    });
  });
}

export {};
