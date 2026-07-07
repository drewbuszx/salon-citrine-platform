/**
 * Focus trap for modals, drawers, and bottom sheets — Fix #39.
 */

const FOCUSABLE =
  "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

export type FocusTrapHandle = {
  activate: (focusTarget?: HTMLElement | null) => void;
  deactivate: (returnFocus?: boolean) => void;
};

export function createFocusTrap(
  container: HTMLElement,
  options: { onEscape?: () => void } = {},
): FocusTrapHandle {
  let lastFocus: HTMLElement | null = null;
  let active = false;

  function focusables() {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.closest("[hidden]") && el.offsetParent !== null,
    );
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault();
      options.onEscape?.();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", onKeyDown);

  return {
    activate(focusTarget) {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      active = true;
      (focusTarget ?? focusables()[0] ?? container).focus();
    },
    deactivate(returnFocus = true) {
      active = false;
      if (returnFocus) {
        (lastFocus ?? container).focus();
      }
    },
  };
}
