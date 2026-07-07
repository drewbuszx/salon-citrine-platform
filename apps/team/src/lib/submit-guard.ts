/**
 * Prevents duplicate form submissions during slow or failed network requests — Fix #45.
 */

export type SubmitGuardOptions = {
  button?: HTMLButtonElement | null;
  busyLabel?: string;
  disabledClass?: string;
};

export function runGuardedSubmit(
  action: () => Promise<void>,
  options: SubmitGuardOptions = {},
): Promise<void> {
  const { button, busyLabel = "Saving…", disabledClass = "is-submitting" } = options;
  if (button?.dataset.submitting === "1") {
    return Promise.resolve();
  }

  const originalLabel = button?.textContent ?? "";
  if (button) {
    button.dataset.submitting = "1";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.classList.add(disabledClass);
    if (busyLabel) button.textContent = busyLabel;
  }

  return action().finally(() => {
    if (!button) return;
    button.dataset.submitting = "0";
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.classList.remove(disabledClass);
    button.textContent = originalLabel;
  });
}
