function formValue(form: HTMLFormElement, name: string) {
  const el = form.elements.namedItem(name);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    ? el.value.trim()
    : "";
}

function initWaitlistOffer() {
  const root = document.querySelector<HTMLElement>("[data-waitlist-offer]");
  const form = root?.querySelector<HTMLFormElement>("[data-waitlist-form]");
  if (!root || !form) return;

  const apiUrl = root.dataset.waitlistApi ?? "";
  const staffSlug = root.dataset.stylistSlug ?? "";
  const serviceIds = (root.dataset.serviceIds ?? "").split(",").filter(Boolean);
  const errorEl = root.querySelector<HTMLElement>("[data-waitlist-error]");
  const successEl = root.querySelector<HTMLElement>("[data-waitlist-success]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (successEl) {
      successEl.hidden = true;
      successEl.textContent = "";
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    submitBtn?.setAttribute("disabled", "true");
    form.setAttribute("aria-busy", "true");
    root.setAttribute("aria-busy", "true");

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffSlug: staffSlug || undefined,
          serviceIds,
          preferredDate: formValue(form, "preferredDate") || undefined,
          clientMessage: formValue(form, "clientMessage") || undefined,
          client: {
            firstName: formValue(form, "firstName"),
            lastName: formValue(form, "lastName"),
            email: formValue(form, "email"),
            phone: formValue(form, "phone") || undefined,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Could not join waitlist");
      }

      form.reset();
      if (successEl) {
        successEl.textContent =
          "You are on the waitlist. We will email you when a time opens up.";
        successEl.hidden = false;
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent =
          err instanceof Error ? err.message : "Could not join waitlist";
        errorEl.hidden = false;
      }
    } finally {
      submitBtn?.removeAttribute("disabled");
      form.removeAttribute("aria-busy");
      root.removeAttribute("aria-busy");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWaitlistOffer);
} else {
  initWaitlistOffer();
}
