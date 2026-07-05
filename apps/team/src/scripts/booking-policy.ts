const root = document.querySelector<HTMLElement>("[data-booking-policy]");
const form = root?.querySelector<HTMLFormElement>("[data-policy-form]");
const apiBase = root?.dataset.apiBase ?? "";
const successEl = root?.querySelector<HTMLElement>("[data-policy-success]");
const errorEl = root?.querySelector<HTMLElement>("[data-policy-error]");
const summaryEl = root?.querySelector<HTMLElement>("[data-policy-summary]");
const depositTypeEl = form?.querySelector<HTMLSelectElement>("[data-deposit-type]");
const depositValueWrap = form?.querySelector<HTMLElement>("[data-deposit-value-wrap]");
const depositValueEl = form?.querySelector<HTMLInputElement>("[data-deposit-value]");
const depositValueHint = form?.querySelector<HTMLElement>("[data-deposit-value-hint]");

function showSuccess(message = "Policy saved.") {
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

function syncDepositFields() {
  const depositType = depositTypeEl?.value ?? "card_on_file";
  const showValue = depositType === "fixed" || depositType === "percent";
  if (depositValueWrap) depositValueWrap.hidden = !showValue;
  if (depositValueHint) {
    depositValueHint.textContent =
      depositType === "percent"
        ? "Percent of cart subtotal (e.g. 25 for 25%)"
        : "Fixed deposit in dollars";
  }
  if (depositValueEl) {
    depositValueEl.required = showValue;
    if (depositType === "percent") {
      depositValueEl.step = "1";
      depositValueEl.max = "100";
    } else {
      depositValueEl.step = "0.01";
      depositValueEl.removeAttribute("max");
    }
  }
}

function readPayload() {
  if (!form) return null;

  const depositType = String(form.depositType.value);
  let depositValue: number | null = null;

  if (depositType === "fixed") {
    const dollars = Number(form.depositValueDollars.value);
    if (!Number.isFinite(dollars) || dollars < 0) {
      throw new Error("Enter a valid fixed deposit amount");
    }
    depositValue = Math.round(dollars * 100);
  } else if (depositType === "percent") {
    const percent = Number(form.depositValueDollars.value);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new Error("Enter a deposit percent between 0 and 100");
    }
    depositValue = Math.round(percent);
  }

  return {
    title: String(form.title.value).trim(),
    cancellationWindowHours: Number(form.cancellationWindowHours.value),
    lateCancelFeePercent: Number(form.lateCancelFeePercent.value),
    noShowFeePercent: Number(form.noShowFeePercent.value),
    lateGraceMinutes: Number(form.lateGraceMinutes.value),
    sameWeekRescheduleWaivesFee: form.sameWeekRescheduleWaivesFee.checked,
    requiresCardOnFile: form.requiresCardOnFile.checked,
    depositType,
    depositValue,
    isActive: form.isActive.checked,
  };
}

depositTypeEl?.addEventListener("change", syncDepositFields);
syncDepositFields();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  successEl && (successEl.hidden = true);

  let payload;
  try {
    payload = readPayload();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Invalid form values");
    return;
  }

  if (!payload) return;

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  submitButton?.setAttribute("disabled", "true");

  try {
    const response = await fetch(apiBase, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      policy?: { title?: string };
    };

    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? "Could not save booking policy");
    }

    showSuccess();
    if (summaryEl && body.policy?.title) {
      summaryEl.textContent =
        "Saved. Guest-facing summary updates on the next booking page load.";
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "Could not save booking policy");
  } finally {
    submitButton?.removeAttribute("disabled");
  }
});
