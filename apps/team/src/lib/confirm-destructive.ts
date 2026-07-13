/**
 * Shared destructive-action confirmation for Manage flows.
 * Uses the native dialog when available so focus stays accessible.
 */

export type ConfirmDestructiveOptions = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function confirmDestructive(options: ConfirmDestructiveOptions): Promise<boolean> {
  const {
    title,
    body,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
  } = options;

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLDialogElement>("[data-confirm-destructive]");
    existing?.remove();

    const dialog = document.createElement("dialog");
    dialog.className = "confirm-destructive";
    dialog.dataset.confirmDestructive = "";
    dialog.setAttribute("aria-labelledby", "confirm-destructive-title");

    dialog.innerHTML = `
      <form method="dialog" class="confirm-destructive__form">
        <h2 id="confirm-destructive-title" class="confirm-destructive__title"></h2>
        <p class="confirm-destructive__body"></p>
        <div class="confirm-destructive__actions">
          <button type="submit" value="cancel" class="ui-btn ui-btn--secondary" data-confirm-cancel></button>
          <button type="submit" value="confirm" class="ui-btn ui-btn--destructive" data-confirm-ok></button>
        </div>
      </form>
    `;

    const titleEl = dialog.querySelector(".confirm-destructive__title");
    const bodyEl = dialog.querySelector(".confirm-destructive__body");
    const cancelBtn = dialog.querySelector("[data-confirm-cancel]");
    const okBtn = dialog.querySelector("[data-confirm-ok]");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    if (cancelBtn) cancelBtn.textContent = cancelLabel;
    if (okBtn) okBtn.textContent = confirmLabel;

    const finish = (confirmed: boolean) => {
      dialog.removeEventListener("close", onClose);
      dialog.remove();
      resolve(confirmed);
    };

    const onClose = () => {
      finish(dialog.returnValue === "confirm");
    };

    dialog.addEventListener("close", onClose);
    document.body.append(dialog);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      (okBtn as HTMLButtonElement | null)?.focus();
    } else {
      const ok = window.confirm(`${title}\n\n${body}`);
      finish(ok);
    }
  });
}
