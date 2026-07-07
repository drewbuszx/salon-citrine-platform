import { loadStripe, type Stripe, type StripeElements, type StripeError } from "@stripe/stripe-js";
import { appendEmbedIfActive } from "../lib/booking-flow";
import {
  fetchCartExpiry,
  formatReservationCountdown,
  lookupExistingClient,
} from "./booking-cart-client";

const form = document.querySelector<HTMLFormElement>("[data-booking-details-form]");
const paymentMount = document.getElementById("payment-element");
const errorEl = document.querySelector<HTMLElement>("[data-form-error]");
const submitBtn = document.querySelector<HTMLButtonElement>("[data-open-policy-modal]");
const submitLabelEl = document.querySelector<HTMLElement>("[data-submit-label]");
const lookupStatusEl = document.querySelector<HTMLElement>("[data-lookup-status]");
const intakeSectionEl = document.querySelector<HTMLElement>("[data-intake-section]");
const newClientWelcomeEl = document.querySelector<HTMLElement>("[data-new-client-welcome]");
const returningWelcomeEl = document.querySelector<HTMLElement>("[data-returning-client-welcome]");
const returningClientInput = document.querySelector<HTMLInputElement>(
  "[data-returning-client-input]",
);
const reservationHoldEl = document.querySelector<HTMLElement>("[data-reservation-hold]");
const reservationCountdownEl = document.querySelector<HTMLElement>(
  "[data-reservation-countdown]",
);

const stripePublishableKey = form?.dataset.stripePublishableKey ?? "";
const setupIntentUrl = form?.dataset.setupIntentUrl ?? "";
const appointmentsUrl = form?.dataset.appointmentsUrl ?? "";
const confirmUrl = form?.dataset.confirmUrl ?? "";
const clientLookupUrl = form?.dataset.clientLookupUrl ?? "";
const cartApiUrl = form?.dataset.cartApiUrl ?? "";
const cartId = form?.dataset.cartId ?? "";
const depositRequiredCents = Number(form?.dataset.depositRequiredCents ?? "0");
const requiresCardOnFile = form?.dataset.requiresCardOnFile === "true";

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
let lookupInFlight = false;
let reservationTimer: ReturnType<typeof setInterval> | null = null;

const SUBMIT_LABEL_DEFAULT =
  depositRequiredCents > 0 ? "Review policy & pay" : "Review policy & book";
const SUBMIT_LABEL_LOADING =
  depositRequiredCents > 0 ? "Processing payment…" : "Booking your appointment…";

const SETUP_INTENT_RECREATE_CODES = new Set([
  "setup_intent_authentication_failure",
  "setup_intent_unexpected_state",
  "setup_intent_invalid_parameter",
  "setup_intent_mandate_invalid",
  "payment_intent_authentication_failure",
]);

function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function stripeAppearance() {
  const dark = isDarkMode();

  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: "#e7ac46",
      colorBackground: dark ? "#181818" : "#faf9f7",
      colorText: dark ? "#ececec" : "#1a1816",
      colorTextSecondary: dark ? "#aaaaaa" : "#787068",
      colorTextPlaceholder: dark ? "#787068" : "#a8a093",
      colorDanger: "#b42318",
      borderRadius: "4px",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    },
    rules: {
      ".Input": {
        backgroundColor: dark ? "#141414" : "#faf9f7",
        borderColor: dark ? "rgba(255, 255, 255, 0.12)" : "#e8e4dc",
        boxShadow: "none",
      },
      ".Input:focus": {
        borderColor: "#e7ac46",
        boxShadow: dark ? "0 0 0 2px rgba(231, 172, 70, 0.25)" : "0 0 0 2px rgba(231, 172, 70, 0.2)",
      },
      ".Label": {
        color: dark ? "#ececec" : "#1a1816",
      },
      ".Tab": {
        borderColor: dark ? "rgba(255, 255, 255, 0.12)" : "#e8e4dc",
      },
      ".Tab--selected": {
        borderColor: "#e7ac46",
        color: dark ? "#ececec" : "#1a1816",
      },
    },
  } as const;
}

function formatStripeConfirmError(error: StripeError): string {
  const code = error.decline_code ?? error.code;

  switch (code) {
    case "card_declined":
    case "generic_decline":
      return "Your card was declined. Try another card or contact your bank.";
    case "insufficient_funds":
      return "Insufficient funds. Try another card or contact your bank.";
    case "expired_card":
      return "This card has expired. Use a different card.";
    case "incorrect_cvc":
      return "The security code (CVC) is incorrect. Check and try again.";
    case "incorrect_number":
      return "The card number is incorrect. Check and try again.";
    case "invalid_expiry_month":
    case "invalid_expiry_year":
      return "The expiration date is invalid. Check and try again.";
    case "processing_error":
      return "We couldn't process your card right now. Wait a moment and try again.";
    case "authentication_required":
      return "Your bank requires additional verification. Follow the prompt and try again.";
    default:
      if (error.type === "validation_error") {
        return error.message ?? "Check your card details and try again.";
      }
      return error.message ?? "Card verification failed. Check your details and try again.";
  }
}

function shouldRecreateSetupIntent(error: StripeError): boolean {
  return SETUP_INTENT_RECREATE_CODES.has(error.code ?? "");
}

function syncStripeAppearance() {
  if (!elements) return;
  elements.update({ appearance: stripeAppearance() });
}

function setPolicyTriggersDisabled(disabled: boolean) {
  for (const btn of document.querySelectorAll<HTMLButtonElement>(
    "[data-open-policy-modal], [data-open-policy-link]",
  )) {
    if (disabled) {
      btn.setAttribute("disabled", "true");
    } else {
      btn.removeAttribute("disabled");
    }
  }
}

function updateSubmitButtonState() {
  if (!submitBtn) return;

  const busy = submitting || initializing;
  if (busy) {
    submitBtn.setAttribute("disabled", "true");
    submitBtn.setAttribute("aria-busy", submitting ? "true" : "false");
  } else {
    submitBtn.removeAttribute("disabled");
    submitBtn.setAttribute("aria-busy", "false");
  }

  setPolicyTriggersDisabled(busy);

  if (submitLabelEl) {
    submitLabelEl.textContent = submitting ? SUBMIT_LABEL_LOADING : SUBMIT_LABEL_DEFAULT;
  }
}

function setSubmitLoading(loading: boolean) {
  submitting = loading;
  updateSubmitButtonState();
}

function setPaymentInitializing(loading: boolean) {
  initializing = loading;
  updateSubmitButtonState();
}

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

function clearFieldErrors() {
  for (const el of form?.querySelectorAll<HTMLElement>("[data-field-error]") ?? []) {
    el.textContent = "";
    el.hidden = true;
  }
  for (const el of form?.querySelectorAll<HTMLElement>(".field--invalid, .form-section--invalid") ?? []) {
    el.classList.remove("field--invalid", "form-section--invalid");
  }
}

function fieldLabel(field: HTMLElement): string {
  const labelSpan = field.querySelector("span:not([data-field-error])");
  if (labelSpan?.textContent?.trim()) return labelSpan.textContent.trim();
  const legend = field.querySelector("legend");
  if (legend?.textContent?.trim()) return legend.textContent.trim();
  return "This field";
}

function showFieldError(field: HTMLElement, message: string) {
  field.classList.add("field--invalid");
  const errorSpan =
    field.querySelector<HTMLElement>("[data-field-error]") ??
    field.parentElement?.querySelector<HTMLElement>("[data-field-error]");
  if (errorSpan) {
    errorSpan.textContent = message;
    errorSpan.hidden = false;
  }
}

function validationMessage(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  if (input.validity.valueMissing) return `${fieldLabel(input.closest(".field, fieldset") ?? input)} is required.`;
  if (input.validity.typeMismatch && input.type === "email") {
    return "Enter a valid email address.";
  }
  if (input.validity.patternMismatch) return `${fieldLabel(input.closest(".field, fieldset") ?? input)} is invalid.`;
  return input.validationMessage || "Please check this field.";
}

function validateFormFields(): boolean {
  clearFieldErrors();
  showError("");

  if (!form) return false;

  const invalid = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input:invalid, select:invalid, textarea:invalid",
  );

  if (invalid) {
    const container = invalid.closest<HTMLElement>(".field, fieldset.field, fieldset.field--inline");
    if (container) {
      showFieldError(container, validationMessage(invalid));
    }
    invalid.focus();
    showError(`${fieldLabel(container ?? invalid)} needs your attention.`);
    return false;
  }

  return true;
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

function showPaymentError(message: string, retryable = false) {
  if (!paymentMount) return;
  paymentMount.replaceChildren();
  if (!message) return;
  const error = document.createElement("p");
  error.className = "payment-element__error";
  error.textContent = message;
  if (retryable) {
    error.setAttribute("role", "button");
    error.tabIndex = 0;
    error.style.cursor = "pointer";
    error.setAttribute("data-payment-retry", "");
  }
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

function checkedValues(name: string): string[] {
  if (!form) return [];
  return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)).map(
    (el) => el.value,
  );
}

function setReturningClientMode(isReturning: boolean) {
  if (returningClientInput) returningClientInput.value = isReturning ? "true" : "false";
  if (intakeSectionEl) intakeSectionEl.hidden = isReturning;
  if (newClientWelcomeEl) newClientWelcomeEl.hidden = isReturning;
  if (returningWelcomeEl) returningWelcomeEl.hidden = !isReturning;

  for (const el of form?.querySelectorAll<HTMLElement>("[data-intake-only]") ?? []) {
    el.hidden = isReturning;
  }

  for (const el of form?.querySelectorAll<HTMLInputElement>("[data-intake-required]") ?? []) {
    if (isReturning) {
      el.removeAttribute("required");
    } else {
      el.setAttribute("required", "");
    }
  }
}

function validateIntakeForNewClient(): boolean {
  if (returningClientInput?.value === "true") return true;

  const referralSources = checkedValues("referralSources");
  if (referralSources.length === 0) {
    const referralField = form?.querySelector<HTMLElement>(
      '[data-field-error-group="referralSources"]',
    )?.closest(".field");
    if (referralField) {
      referralField.classList.add("field--invalid");
      showFieldError(
        referralField,
        "Select at least one option for how you heard about us.",
      );
    }
    showError("Select at least one option for how you heard about us.");
    return false;
  }

  return true;
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
    showPaymentStatus("Enter your email to securely load the card form.");
    return;
  }

  if (initializing) return;
  if (elements && !forceRecreate && setupIntentEmail === email) return;

  if (forceRecreate || (elements && setupIntentEmail !== email)) {
    resetStripeElements();
  }

  if (elements) return;

  if (!requiresCardOnFile && depositRequiredCents <= 0) {
    showPaymentStatus("No card needed for this booking.");
    return;
  }

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
  setPaymentInitializing(true);

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
      throw new Error(payload.error ?? "We couldn't load the card form. Please try again.");
    }

    if (!("clientSecret" in payload) || typeof payload.clientSecret !== "string") {
      throw new Error("We couldn't load the card form. Please try again.");
    }

    stripe = await loadStripe(stripePublishableKey);
    if (!stripe) throw new Error("Could not load Stripe");

    elements = stripe.elements({
      clientSecret: payload.clientSecret as string,
      appearance: stripeAppearance(),
    });

    const paymentElement = elements.create("payment");
    paymentMount?.replaceChildren();
    await paymentElement.mount("#payment-element");
    setupIntentId =
      typeof payload.setupIntentId === "string" ? payload.setupIntentId : null;
    setupIntentEmail = email;
    setPaymentBusy(false);
  } catch (error) {
    const message = formatBookingError(error, "We couldn't load the card form. Please try again.");
    logBookingError("setup-intent", error);
    showError(message);
    showPaymentError(`${message} Tap to try again.`, true);
    setPaymentBusy(false);
  } finally {
    initializing = false;
    setPaymentInitializing(false);
  }
}

paymentMount?.addEventListener("focusin", () => {
  ensureStripeElements();
});

paymentMount?.addEventListener("click", (event) => {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.hasAttribute("data-payment-retry") || target.closest("[data-payment-retry]"))
  ) {
    void ensureStripeElements(true);
    return;
  }
  if (!elements && !initializing && formValue("email")) {
    void ensureStripeElements();
  }
});

paymentMount?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.hasAttribute("data-payment-retry") || target.closest("[data-payment-retry]"))
  ) {
    event.preventDefault();
    void ensureStripeElements(true);
  }
});

const themeObserver = new MutationObserver(() => {
  syncStripeAppearance();
});
themeObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

form?.querySelector('input[name="email"]')?.addEventListener("blur", () => {
  void ensureStripeElements();
  void lookupClientByEmail();
});

async function lookupClientByEmail() {
  const email = formValue("email");
  if (!email || !clientLookupUrl || lookupInFlight) return;

  lookupInFlight = true;
  if (lookupStatusEl) {
    lookupStatusEl.hidden = false;
    lookupStatusEl.textContent = "Looking up your profile…";
  }

  try {
    const result = await lookupExistingClient({ lookupUrl: clientLookupUrl, email });
    if (result.found && result.client) {
      setReturningClientMode(true);

      const firstNameEl = form?.elements.namedItem("firstName");
      const lastNameEl = form?.elements.namedItem("lastName");
      const phoneEl = form?.elements.namedItem("phone");
      const notesEl = form?.elements.namedItem("intakeNotes");
      const prefsEl = form?.elements.namedItem("bookingPreferences");
      const birthdayEl = form?.elements.namedItem("birthday");
      const addressLine1El = form?.elements.namedItem("addressLine1");
      const addressLine2El = form?.elements.namedItem("addressLine2");
      const addressCityEl = form?.elements.namedItem("addressCity");
      const addressStateEl = form?.elements.namedItem("addressState");
      const addressZipEl = form?.elements.namedItem("addressZip");

      if (firstNameEl instanceof HTMLInputElement && !firstNameEl.value) {
        firstNameEl.value = result.client.firstName;
      }
      if (lastNameEl instanceof HTMLInputElement && !lastNameEl.value) {
        lastNameEl.value = result.client.lastName;
      }
      if (phoneEl instanceof HTMLInputElement && !phoneEl.value && result.client.phone) {
        phoneEl.value = result.client.phone;
      }
      if (notesEl instanceof HTMLTextAreaElement && !notesEl.value && result.client.intakeNotes) {
        notesEl.value = result.client.intakeNotes;
      }
      if (
        prefsEl instanceof HTMLTextAreaElement &&
        !prefsEl.value &&
        result.client.bookingPreferences
      ) {
        prefsEl.value = result.client.bookingPreferences;
      }
      if (birthdayEl instanceof HTMLInputElement && !birthdayEl.value && result.client.birthday) {
        birthdayEl.value = result.client.birthday;
      }
      if (
        addressLine1El instanceof HTMLInputElement &&
        !addressLine1El.value &&
        result.client.addressLine1
      ) {
        addressLine1El.value = result.client.addressLine1;
      }
      if (
        addressLine2El instanceof HTMLInputElement &&
        !addressLine2El.value &&
        result.client.addressLine2
      ) {
        addressLine2El.value = result.client.addressLine2;
      }
      if (
        addressCityEl instanceof HTMLInputElement &&
        !addressCityEl.value &&
        result.client.addressCity
      ) {
        addressCityEl.value = result.client.addressCity;
      }
      if (
        addressStateEl instanceof HTMLInputElement &&
        !addressStateEl.value &&
        result.client.addressState
      ) {
        addressStateEl.value = result.client.addressState;
      }
      if (
        addressZipEl instanceof HTMLInputElement &&
        !addressZipEl.value &&
        result.client.addressZip
      ) {
        addressZipEl.value = result.client.addressZip;
      }

      if (result.client.preferredContactMethod) {
        const preferredEl = form?.querySelector<HTMLInputElement>(
          `input[name="preferredContactMethod"][value="${result.client.preferredContactMethod}"]`,
        );
        if (preferredEl) preferredEl.checked = true;
      }

      if (lookupStatusEl) {
        lookupStatusEl.textContent = `Welcome back, ${result.client.firstName}! We filled in your details.`;
      }
    } else {
      setReturningClientMode(false);
      if (lookupStatusEl) {
        lookupStatusEl.textContent = "";
        lookupStatusEl.hidden = true;
      }
    }
  } catch {
    if (lookupStatusEl) {
      lookupStatusEl.textContent = "";
      lookupStatusEl.hidden = true;
    }
  } finally {
    lookupInFlight = false;
  }
}

async function startReservationCountdown() {
  if (!cartId || !cartApiUrl || !reservationHoldEl) return;

  reservationHoldEl.hidden = false;

  async function tick() {
    const expiresAt = await fetchCartExpiry({ cartApiUrl, cartId });
    if (!expiresAt) {
      if (reservationCountdownEl) reservationCountdownEl.textContent = "a limited time";
      return;
    }
    const label = formatReservationCountdown(expiresAt);
    if (reservationCountdownEl) reservationCountdownEl.textContent = label;
    if (label === "Expired") {
      showError("Your reserved time has expired. Head back to choose a new time.");
      if (reservationTimer) clearInterval(reservationTimer);
    }
  }

  await tick();
  reservationTimer = setInterval(() => void tick(), 30_000);
}

void startReservationCountdown();

const MOBILE_SUBMIT_BAR_MQ = window.matchMedia("(max-width: 639px)");

function keyboardInset(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function updateMobileSubmitBar() {
  const submitBar = document.querySelector<HTMLElement>(".submit-bar");
  if (!submitBar) return;

  if (!MOBILE_SUBMIT_BAR_MQ.matches) {
    submitBar.style.removeProperty("transform");
    return;
  }

  const inset = keyboardInset();
  submitBar.style.transform = inset > 0 ? `translateY(-${inset}px)` : "";
}

function setupMobileSubmitBar() {
  const submitBar = document.querySelector<HTMLElement>(".submit-bar");
  if (!submitBar) return;

  const vv = window.visualViewport;
  vv?.addEventListener("resize", updateMobileSubmitBar);
  vv?.addEventListener("scroll", updateMobileSubmitBar);
  MOBILE_SUBMIT_BAR_MQ.addEventListener("change", updateMobileSubmitBar);
  updateMobileSubmitBar();

  form?.addEventListener("focusin", (event) => {
    if (!MOBILE_SUBMIT_BAR_MQ.matches) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("input, textarea, select")) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      updateMobileSubmitBar();
    });
  });
}

setupMobileSubmitBar();

form?.querySelector('input[name="email"]')?.addEventListener("input", () => {
  const email = formValue("email");
  if (setupIntentEmail && email !== setupIntentEmail) {
    resetStripeElements();
    showPaymentStatus("Enter your email to securely load the card form.");
  }
  const field = form?.querySelector<HTMLElement>('input[name="email"]')?.closest(".field");
  field?.classList.remove("field--invalid");
  field?.querySelector<HTMLElement>("[data-field-error]")?.setAttribute("hidden", "");
});

for (const input of form?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
  "input, textarea",
) ?? []) {
  input.addEventListener("input", () => {
    const field = input.closest<HTMLElement>(".field, fieldset.field, fieldset.field--inline");
    if (!field) return;
    if (input.checkValidity()) {
      field.classList.remove("field--invalid");
      const err = field.querySelector<HTMLElement>("[data-field-error]");
      if (err) {
        err.textContent = "";
        err.hidden = true;
      }
    }
  });
}

for (const checkbox of form?.querySelectorAll<HTMLInputElement>(
  'input[name="referralSources"]',
) ?? []) {
  checkbox.addEventListener("change", () => {
    if (checkedValues("referralSources").length > 0) {
      const field = form?.querySelector<HTMLElement>(
        '[data-field-error-group="referralSources"]',
      )?.closest(".field");
      field?.classList.remove("field--invalid");
      const err = field?.querySelector<HTMLElement>("[data-field-error]");
      if (err) {
        err.textContent = "";
        err.hidden = true;
      }
    }
  });
}

async function completeBooking() {
  if (submitting) return;

  const email = formValue("email");
  if (!email) {
    showError("Enter your email to continue.");
    return;
  }

  if (!validateFormFields()) {
    return;
  }

  if (!validateIntakeForNewClient()) {
    return;
  }

  if (!policyAcknowledged()) {
    showError("Please read and accept the booking policy to continue.");
    return;
  }

  if (!stripe || !elements || !setupIntentId || setupIntentEmail !== email) {
    await ensureStripeElements(setupIntentEmail !== null && setupIntentEmail !== email);
    if (!stripe || !elements || !setupIntentId) {
      if (!requiresCardOnFile && depositRequiredCents <= 0) {
        showError("Complete your details to continue.");
      } else {
        showError("Enter your details and card information to continue.");
      }
      return;
    }
  }

  showError("");
  setSubmitLoading(true);

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
          declineCode: confirmError.decline_code,
          setupIntentId,
        });

        const message = formatStripeConfirmError(confirmError);
        showError(message);

        if (shouldRecreateSetupIntent(confirmError)) {
          resetStripeElements();
          await ensureStripeElements(true);
        }

        throw new Error(message);
      }

      if (!setupIntent || setupIntent.status !== "succeeded") {
        throw new Error("Card verification incomplete");
      }

      verifiedSetupIntentId = setupIntent.id;
      confirmedSetupIntentId = setupIntent.id;
    }

    const isReturningClient = returningClientInput?.value === "true";
    const referralSources = checkedValues("referralSources");

    const bookingBody = {
      staffSlug: formValue("stylist"),
      serviceIds: formValue("services").split(",").filter(Boolean),
      startsAt: formValue("startsAt"),
      cartId: formValue("cartId") || undefined,
      client: {
        firstName: formValue("firstName"),
        lastName: formValue("lastName"),
        email: formValue("email"),
        phone: formValue("phone"),
        smsOptIn: checkboxChecked("smsOptIn"),
        intakeNotes: formValue("intakeNotes") || undefined,
        bookingPreferences: formValue("bookingPreferences") || undefined,
        birthday: formValue("birthday") || undefined,
        addressLine1: formValue("addressLine1") || undefined,
        addressLine2: formValue("addressLine2") || undefined,
        addressCity: formValue("addressCity") || undefined,
        addressState: formValue("addressState").toUpperCase() || undefined,
        addressZip: formValue("addressZip") || undefined,
        preferredContactMethod: formValue("preferredContactMethod") || undefined,
        referralSources: referralSources.length > 0 ? referralSources : undefined,
        isReturningClient,
      },
      referralSource: referralSources.length > 0 ? referralSources.join(", ") : undefined,
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
      throw new Error(
        payload.error ??
          "We couldn't complete your booking. Your card was not charged again — please try again.",
      );
    }

    if (!payload.id) {
      throw new Error(
        "We couldn't save your appointment. Please try again or call the salon.",
      );
    }

    const params = new URLSearchParams({ appointment: payload.id });
    if (formValue("flow") === "stylist") params.set("flow", "stylist");
    appendEmbedIfActive(params);
    window.location.href = `${confirmUrl}?${params.toString()}`;
  } catch (error) {
    logBookingError("completeBooking", error);
    showError(
      formatBookingError(
        error,
        "We couldn't complete your booking. Please try again or call the salon.",
      ),
    );
    setSubmitLoading(false);
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
