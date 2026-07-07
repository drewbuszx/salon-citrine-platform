const root = document.querySelector<HTMLElement>("[data-manage-business]");
const form = root?.querySelector<HTMLFormElement>("[data-business-form]");
const apiBase = root?.dataset.apiBase ?? "";
const successEl = root?.querySelector<HTMLElement>("[data-business-success]");
const errorEl = root?.querySelector<HTMLElement>("[data-business-error]");

function showSuccess(message = "Business details saved.") {
  if (successEl) {
    successEl.textContent = message;
    successEl.hidden = false;
  }
  if (errorEl) errorEl.hidden = true;
}

function showError(message: string) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  if (successEl) successEl.hidden = true;
}

function readBusinessHours() {
  const hours: Record<number, { open: string; close: string } | null> = {};
  root?.querySelectorAll<HTMLElement>("[data-day-row]").forEach((row) => {
    const day = Number(row.dataset.day);
    const enabled = row.querySelector<HTMLInputElement>("[data-hours-enabled]")?.checked;
    if (!enabled) {
      hours[day] = null;
      return;
    }
    const open = row.querySelector<HTMLInputElement>("[data-hours-open]")?.value ?? "10:00";
    const close = row.querySelector<HTMLInputElement>("[data-hours-close]")?.value ?? "17:00";
    hours[day] = { open, close };
  });
  return hours;
}

root?.querySelectorAll<HTMLInputElement>("[data-hours-enabled]").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const row = checkbox.closest("[data-day-row]");
    const times = row?.querySelector<HTMLElement>("[data-hours-times]");
    if (times) times.hidden = !checkbox.checked;
  });
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form) return;

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  submitButton?.setAttribute("disabled", "true");

  const payload = {
    name: String((form.elements.namedItem("name") as HTMLInputElement).value).trim(),
    tagline: String((form.elements.namedItem("tagline") as HTMLTextAreaElement).value).trim(),
    addressLine1: String((form.elements.namedItem("addressLine1") as HTMLInputElement).value).trim(),
    addressLine2: String((form.elements.namedItem("addressLine2") as HTMLInputElement).value).trim(),
    city: String((form.elements.namedItem("city") as HTMLInputElement).value).trim(),
    state: String((form.elements.namedItem("state") as HTMLInputElement).value).trim(),
    postalCode: String((form.elements.namedItem("postalCode") as HTMLInputElement).value).trim(),
    phone: String((form.elements.namedItem("phone") as HTMLInputElement).value).trim(),
    email: String((form.elements.namedItem("email") as HTMLInputElement).value).trim(),
    bookingEmail: String((form.elements.namedItem("bookingEmail") as HTMLInputElement).value).trim(),
    timezone: String((form.elements.namedItem("timezone") as HTMLInputElement).value).trim(),
    instagramUrl: String((form.elements.namedItem("instagramUrl") as HTMLInputElement).value).trim(),
    logoUrl: String((form.elements.namedItem("logoUrl") as HTMLInputElement).value).trim(),
    isActive: (form.elements.namedItem("isActive") as HTMLInputElement).checked,
    businessHours: readBusinessHours(),
  };

  try {
    const response = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? "Could not save business details");
    }
    showSuccess();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not save business details");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
