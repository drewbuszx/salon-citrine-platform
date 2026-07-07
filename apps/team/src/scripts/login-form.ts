const REMEMBER_KEY = "sc_team_remember";
const EMAIL_KEY = "sc_team_login_email";
const CAPS_WARNING_ID = "login-caps-warning";
/** Demo-only address for screenshots; never persist so real accounts keep working. */
const DEMO_EMAIL = "team@saloncitrineindy.com";

function qs<T extends HTMLElement>(sel: string, root: ParentNode = document) {
  return root.querySelector<T>(sel);
}

function setFieldError(input: HTMLInputElement, message: string | null) {
  const field = input.closest<HTMLElement>("[data-field]");
  const errorEl = field?.querySelector<HTMLElement>("[data-field-error]");
  if (!field || !errorEl) return;

  if (message) {
    input.setAttribute("aria-invalid", "true");
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.setAttribute("aria-describedby", errorEl.id || `${input.id}-error`);
    if (!errorEl.id) errorEl.id = `${input.id}-error`;
  } else {
    input.removeAttribute("aria-invalid");
    errorEl.textContent = "";
    errorEl.hidden = true;
    if (input.id === "login-password") {
      syncPasswordDescribedBy(input);
    } else {
      input.removeAttribute("aria-describedby");
    }
  }
}

function syncPasswordDescribedBy(passwordInput: HTMLInputElement) {
  const capsWarning = qs<HTMLElement>(`#${CAPS_WARNING_ID}`);
  if (passwordInput.getAttribute("aria-invalid") === "true") return;

  if (capsWarning && !capsWarning.hidden) {
    passwordInput.setAttribute("aria-describedby", CAPS_WARNING_ID);
  } else {
    passwordInput.removeAttribute("aria-describedby");
  }
}

function validateEmail(input: HTMLInputElement) {
  const value = input.value.trim();
  if (!value) {
    setFieldError(input, "Email is required.");
    return false;
  }
  if (!input.checkValidity()) {
    setFieldError(input, "Enter a valid email address.");
    return false;
  }
  setFieldError(input, null);
  return true;
}

function validatePassword(input: HTMLInputElement) {
  if (!input.value) {
    setFieldError(input, "Password is required.");
    return false;
  }
  setFieldError(input, null);
  return true;
}

function setPasswordVisible(
  passwordInput: HTMLInputElement,
  toggleBtn: HTMLButtonElement,
  visible: boolean,
) {
  passwordInput.type = visible ? "text" : "password";
  toggleBtn.setAttribute("aria-pressed", String(visible));
  toggleBtn.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  toggleBtn.title = visible ? "Hide password" : "Show password";
}

function announceStatus(message: string) {
  const status = qs<HTMLElement>("[data-login-status]");
  if (status) status.textContent = message;
}

function setSubmitting(submitBtn: HTMLButtonElement, submitting: boolean) {
  const spinner = qs<HTMLElement>("[data-login-spinner]", submitBtn);
  const label = qs<HTMLElement>("[data-login-submit-label]", submitBtn);
  const form = submitBtn.closest<HTMLFormElement>("[data-login-form]");
  const toggleBtn = form?.querySelector<HTMLButtonElement>("[data-password-toggle]");

  submitBtn.disabled = submitting;
  submitBtn.setAttribute("aria-busy", String(submitting));
  toggleBtn?.toggleAttribute("disabled", submitting);

  if (spinner) spinner.hidden = !submitting;
  if (label) label.textContent = submitting ? "Signing in" : "Sign in";

  announceStatus(submitting ? "Signing in, please wait." : "");
}

function initLoginForm() {
  const form = qs<HTMLFormElement>("[data-login-form]");
  if (!form) return;

  const emailInput = qs<HTMLInputElement>("#login-email", form);
  const passwordInput = qs<HTMLInputElement>("#login-password", form);
  const rememberInput = qs<HTMLInputElement>("#login-remember", form);
  const submitBtn = qs<HTMLButtonElement>("[data-login-submit]", form);
  const toggleBtn = qs<HTMLButtonElement>("[data-password-toggle]", form);
  const capsWarning = qs<HTMLElement>("[data-caps-warning]", form);

  if (!emailInput || !passwordInput || !submitBtn) return;

  const urlEmail = new URL(window.location.href).searchParams.get("email")?.trim();
  const savedEmail = sessionStorage.getItem(EMAIL_KEY);
  if (
    !urlEmail &&
    savedEmail &&
    !emailInput.value &&
    savedEmail.toLowerCase() !== DEMO_EMAIL
  ) {
    emailInput.value = savedEmail;
  }

  const savedRemember = localStorage.getItem(REMEMBER_KEY);
  if (rememberInput && savedRemember === "1") {
    rememberInput.checked = true;
  }

  toggleBtn?.addEventListener("click", () => {
    const showing = passwordInput.type === "text";
    setPasswordVisible(passwordInput, toggleBtn, !showing);
    passwordInput.focus();
  });

  function updateCapsWarning(event: KeyboardEvent) {
    if (!capsWarning) return;
    const capsOn = event.getModifierState?.("CapsLock") ?? false;
    capsWarning.hidden = !capsOn;
    syncPasswordDescribedBy(passwordInput);
  }

  function probeCapsLock() {
    if (!capsWarning) return;
    function onKey(event: KeyboardEvent) {
      updateCapsWarning(event);
      passwordInput.removeEventListener("keydown", onKey);
      passwordInput.removeEventListener("keyup", onKey);
    }
    passwordInput.addEventListener("keydown", onKey);
    passwordInput.addEventListener("keyup", onKey);
  }

  passwordInput.addEventListener("keydown", updateCapsWarning);
  passwordInput.addEventListener("keyup", updateCapsWarning);
  passwordInput.addEventListener("focus", probeCapsLock);
  passwordInput.addEventListener("blur", () => {
    if (capsWarning) capsWarning.hidden = true;
    syncPasswordDescribedBy(passwordInput);
    if (passwordInput.value) validatePassword(passwordInput);
  });

  emailInput.addEventListener("blur", () => {
    if (emailInput.value.trim()) validateEmail(emailInput);
  });

  form.addEventListener("submit", (event) => {
    const emailOk = validateEmail(emailInput);
    const passwordOk = validatePassword(passwordInput);
    if (!emailOk || !passwordOk) {
      event.preventDefault();
      if (!emailOk) emailInput.focus();
      else passwordInput.focus();
      return;
    }

    const trimmedEmail = emailInput.value.trim();
    if (trimmedEmail.toLowerCase() !== DEMO_EMAIL) {
      sessionStorage.setItem(EMAIL_KEY, trimmedEmail);
    }

    if (rememberInput) {
      if (rememberInput.checked) {
        localStorage.setItem(REMEMBER_KEY, "1");
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    }

    if (submitBtn.disabled || submitBtn.getAttribute("aria-busy") === "true") {
      event.preventDefault();
      return;
    }

    setSubmitting(submitBtn, true);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoginForm);
} else {
  initLoginForm();
}
