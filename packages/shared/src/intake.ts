/** Preferred contact method for new-client intake. */
export const PREFERRED_CONTACT_METHODS = ["text", "email", "call"] as const;
export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];

export const PREFERRED_CONTACT_LABELS: Record<PreferredContactMethod, string> = {
  text: "Text message",
  email: "Email",
  call: "Phone call",
};

/** "How did you hear about us?" — multi-select options. */
export const INTAKE_REFERRAL_SOURCES = [
  "Google / search",
  "Instagram",
  "Facebook",
  "Friend or family referral",
  "Walk-by / drove past",
  "Yelp",
  "TikTok",
  "Other",
] as const;
export type IntakeReferralSource = (typeof INTAKE_REFERRAL_SOURCES)[number];

export const NEW_CLIENT_INTAKE_WELCOME =
  "Welcome! Since this is your first visit with us, please complete the intake form below so your stylist can prepare for your appointment.";

export const RETURNING_CLIENT_INTAKE_NOTE =
  "Welcome back! Your profile is on file — update anything below if it has changed.";
