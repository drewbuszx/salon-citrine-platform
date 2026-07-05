import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

const form = document.querySelector<HTMLFormElement>("[data-booking-details-form]");
const paymentMount = document.getElementById("payment-element");
const errorEl = document.querySelector<HTMLElement>("[data-form-error]");
const submitBtn = document.querySelector<HTMLButtonElement>("[data-open-policy-modal]");

const stripePublishableKey = form?.dataset.stripePublishableKey ?? "";
const setupIntentUrl = form?.dataset.setupIntentUrl ?? "";
const appointmentsUrl = form?.dataset.appointmentsUrl ?? "";
const confirmUrl = form?.dataset.confirmUrl ?? "";

let stripe: Stripe | null = null;
let elements: StripeElements | null = null;
let setupIntentId: string | null = null;
/** Email used when the current setup intent was created (must match before confirm). */
let setupIntentEmail: string | null = null;
/** Setup intent id that already passed client-side confirmSetup successfully. */
let confirmedSetupIntentId: string | null = null;
let pendingSubmit = false;
let initializing = false;
let submitting = false;

function showError(message: string) {
  if (!errorEl) return;
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}

function setPaymentBusy(busy: boolean) {
  paymentMount?.setAttribute("aria-busy", busy ? "true" : "false");
}

function showPaymentStatus(message: string) {
  if (!paymentMount) return;
  paymentMount.replaceChildren();
  if (!message) return;
  const status = document.createElement("p");
  status.className = "payment-element__status";
  status.textContent = message;
  paymentMount.appendChild(status);
}

function showPaymentError(message: string) {
  if (!paymentMount) return;
  paymentMount.replaceChildren();
  if (!message) return;
  const error = document.createElement("p");
  error.className = "payment-element__error";
  error.textContent = message;
  paymentMount.appendChild(error);
}

function formValue(name: string) {
  const el = form?.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el.value.trim() : "";
}

function checkboxChecked(name: string) {
  const el = form?.elements.namedItem(name);
  return el instanceof HTMLInputElement && el.checked;
}

function policyAcknowledged(): boolean {
  const el = form?.elements.namedItem("policyAck");
  return el instanceof HTMLInputElement && el.value === "true";
}

function logBookingError(phase: string, error: unknown, extra?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  console.error(`[booking/details] ${phase}`, error, extra ?? "");
}

function formatBookingError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

async function readJsonResponse(response: Response): Promise<{
  error?: string;
  id?: string;
  clientSecret?: string;
  setupIntentId?: string;
}> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as {
      error?: string;
      id?: string;
      clientSecret?: string;
      setupIntentId?: string;
    };
  } catch (parseError) {
    logBookingError("invalid JSON response", parseError, {
      status: response.status,
      bodyPreview: text.slice(0, 200),
    });
    return {};
  }
}

function resetStripeElements() {
  elements = null;
  setupIntentId = null;
  setupIntentEmail = null;
  confirmedSetupIntentId = null;
}

async function ensureStripeElements(forceRecreate = false) {
  const email = formValue("email");
  if (!email) {
    showPaymentStatus("Enter your email above to load the card form.");
    return;
  }

  if (initializing) return;
  if (elements && !forceRecreate && setupIntentEmail === email) return;

  if (forceRecreate || (elements && setupIntentEmail !== email)) {
    resetStripeElements();
  }

  if (elements) return;

  if (!stripePublishableKey) {
    const message = "Card collection is not configured. Please contact the salon.";
    showError(message);
    showPaymentError(message);
    setPaymentBusy(false);
    return;
  }

  initializing = true;
  showError("");
  showPaymentStatus("Loading secure card form…");
  setPaymentBusy(true);

  try {
    const response = await fetch(setupIntentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formValue("email") || undefined,
        firstName: formValue("firstName") || undefined,
        lastName: formValue("lastName") || undefined,
      }),
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not initialize card form");
    }

    if (!("clientSecret" in payload) || typeof payload.clientSecret !== "string") {
      throw new Error("Could not initialize card form");
    }

    stripe = await loadStripe(stripePublishableKey);
    if (!stripe) throw new Error("Could not load Stripe");

    elements = stripe.elements({
      clientSecret: payload.clientSecret as string,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#e7ac46",
        },
      },
    });

    const paymentElement = elements.create("payment");
    paymentMount?.replaceChildren();
    await paymentElement.mount("#payment-element");
    setupIntentId =
      typeof payload.setupIntentId === "string" ? payload.setupIntentId : null;
    setupIntentEmail = email;
    setPaymentBusy(false);
  } catch (error) {
    const message = formatBookingError(error, "Could not load card form");
    logBookingError("setup-intent", error);
    showError(message);
    showPaymentError(message);
    setPaymentBusy(false);
  } finally {
    initializing = false;
  }
}

paymentMount?.addEventListener("focusin", () => {
  ensureStripeElements();
});

form?.querySelector('input[name="email"]')?.addEventListener("blur", () => {
  void ensureStripeElements();
});

form?.querySelector('input[name="email"]')?.addEventListener("input", () => {
  const email = formValue("email");
  if (setupIntentEmail && email !== setupIntentEmail) {
    resetStripeElements();
    showPaymentStatus("Enter your email above to load the card form.");
  }
});

async function completeBooking() {
  if (submitting) return;

  const email = formValue("email");
  if (!email) {
    showError("Enter your email to continue.");
    return;
  }

  if (!form?.reportValidity()) {
    showError("Please complete the required fields.");
    return;
  }

  if (!policyAcknowledged()) {
    showError("Please review and acknowledge the booking policy.");
    return;
  }

  if (!stripe || !elements || !setupIntentId || setupIntentEmail !== email) {
    await ensureStripeElements(setupIntentEmail !== null && setupIntentEmail !== email);
    if (!stripe || !elements || !setupIntentId) {
      showError("Enter your details and card information to continue.");
      return;
    }
  }

  showError("");
  submitting = true;
  submitBtn?.setAttribute("disabled", "true");

  try {
    let verifiedSetupIntentId = confirmedSetupIntentId;

    if (!verifiedSetupIntentId || verifiedSetupIntentId !== setupIntentId) {
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          payment_method_data: {
            billing_details: {
              name: `${formValue("firstName")} ${formValue("lastName")}`.trim(),
              email,
              phone: formValue("phone"),
            },
          },
        },
      });

      if (confirmError) {
        logBookingError("confirmSetup", confirmError, {
          type: confirmError.type,
          code: confirmError.code,
          setupIntentId,
        });
        throw new Error(confirmError.message ?? "Card verification failed");
      }

      if (!setupIntent || setupIntent.status !== "succeeded") {
        throw new Error("Card verification incomplete");
      }

      verifiedSetupIntentId = setupIntent.id;
      confirmedSetupIntentId = setupIntent.id;
    }

    const bookingBody = {
      staffSlug: formValue("stylist"),
      serviceIds: formValue("services").split(",").filter(Boolean),
      startsAt: formValue("startsAt"),
      client: {
        firstName: formValue("firstName"),
        lastName: formValue("lastName"),
        email: formValue("email"),
        phone: formValue("phone"),
        smsOptIn: checkboxChecked("smsOptIn"),
        intakeNotes: formValue("intakeNotes") || undefined,
        bookingPreferences: formValue("bookingPreferences") || undefined,
      },
      policyAcknowledged: policyAcknowledged(),
      setupIntentId: verifiedSetupIntentId,
    };

    const response = await fetch(appointmentsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingBody),
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      logBookingError("appointments", payload.error ?? response.statusText, {
        status: response.status,
        bookingBody,
      });
      throw new Error(payload.error ?? "Could not save your appointment");
    }

    if (!payload.id) {
      throw new Error("Could not save your appointment");
    }

    const params = new URLSearchParams({ appointment: payload.id });
    if (formValue("flow") === "stylist") params.set("flow", "stylist");
    window.location.href = `${confirmUrl}?${params.toString()}`;
  } catch (error) {
    logBookingError("completeBooking", error);
    showError(formatBookingError(error, "Booking failed"));
    submitBtn?.removeAttribute("disabled");
    submitting = false;
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!pendingSubmit) return;
  pendingSubmit = false;
  completeBooking();
});

document.addEventListener("policy-confirmed", () => {
  const ack = document.querySelector<HTMLInputElement>("#policy-ack");
  if (ack) ack.value = "true";
  pendingSubmit = true;
  form?.requestSubmit();
});
