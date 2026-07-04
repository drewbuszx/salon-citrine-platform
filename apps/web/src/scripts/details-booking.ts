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
let pendingSubmit = false;
let initializing = false;

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

async function ensureStripeElements() {
  if (elements || initializing) return;
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

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not initialize card form");
    }

    stripe = await loadStripe(stripePublishableKey);
    if (!stripe) throw new Error("Could not load Stripe");

    elements = stripe.elements({
      clientSecret: payload.clientSecret,
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
    setupIntentId = payload.setupIntentId;
    setPaymentBusy(false);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load card form";
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
  if (!elements) ensureStripeElements();
});

async function completeBooking() {
  if (!form || !stripe || !elements || !setupIntentId) {
    await ensureStripeElements();
    if (!stripe || !elements || !setupIntentId) {
      showError("Enter your details and card information to continue.");
      return;
    }
  }

  showError("");
  submitBtn?.setAttribute("disabled", "true");

  try {
    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: `${formValue("firstName")} ${formValue("lastName")}`.trim(),
            email: formValue("email"),
            phone: formValue("phone"),
          },
        },
      },
    });

    if (confirmError) {
      throw new Error(confirmError.message ?? "Card verification failed");
    }

    if (!setupIntent || setupIntent.status !== "succeeded") {
      throw new Error("Card verification incomplete");
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
      },
      policyAcknowledged: true,
      setupIntentId: setupIntent.id,
    };

    const response = await fetch(appointmentsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingBody),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not save your appointment");
    }

    const params = new URLSearchParams({ appointment: payload.id });
    if (formValue("flow") === "stylist") params.set("flow", "stylist");
    window.location.href = `${confirmUrl}?${params.toString()}`;
  } catch (error) {
    showError(error instanceof Error ? error.message : "Booking failed");
    submitBtn?.removeAttribute("disabled");
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

ensureStripeElements();
