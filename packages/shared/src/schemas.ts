import { z } from "zod";
import { INTAKE_REFERRAL_SOURCES, PREFERRED_CONTACT_METHODS } from "./intake.js";

export const preferredContactMethodSchema = z.enum(PREFERRED_CONTACT_METHODS);
export type PreferredContactMethod = z.infer<typeof preferredContactMethodSchema>;

export const intakeReferralSourceSchema = z.enum(INTAKE_REFERRAL_SOURCES);

/**
 * Zod schemas mirroring the Supabase schema (packages/db/migrations).
 * Stubs for Phase 1 — extend as the API surface grows.
 */

export const staffRoleSchema = z.enum([
  "owner",
  "stylist",
  "esthetician",
  "front_desk",
]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const appointmentStatusSchema = z.enum([
  "booked",
  "pending",
  "confirmed",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const staffSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  role: staffRoleSchema,
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  glossgeniusToken: z.string().nullable(),
  isBookable: z.boolean(),
  acceptingNewClients: z.boolean(),
});
export type Staff = z.infer<typeof staffSchema>;

export const serviceSchema = z.object({
  id: z.string().uuid(),
  category: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** null = complimentary/consult-priced */
  basePriceCents: z.number().int().nonnegative().nullable(),
  durationMinutes: z.number().int().positive(),
  /** "$55+" starting-rate display */
  priceVaries: z.boolean(),
  /** NOT A STANDALONE SERVICE */
  isAddon: z.boolean(),
  requiresConsultation: z.boolean(),
  isActive: z.boolean(),
});
export type Service = z.infer<typeof serviceSchema>;

export const clientSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  smsOptIn: z.boolean(),
  emailOptIn: z.boolean(),
  intakeNotes: z.string().nullable().optional(),
  bookingPreferences: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  addressCity: z.string().nullable().optional(),
  addressState: z.string().nullable().optional(),
  addressZip: z.string().nullable().optional(),
  preferredContactMethod: preferredContactMethodSchema.nullable().optional(),
  referralSources: z.array(z.string()).optional(),
});
export type Client = z.infer<typeof clientSchema>;

export const appointmentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  staffId: z.string().uuid(),
  /** UTC ISO timestamps; display in America/Indiana/Indianapolis */
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: appointmentStatusSchema,
  notes: z.string().nullable(),
  stripePaymentIntentId: z.string().nullable(),
  policySnapshot: z.record(z.unknown()).optional(),
  depositRequiredCents: z.number().int().nonnegative().optional(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

/** POST /api/booking/setup-intent request body */
export const createSetupIntentInputSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});
export type CreateSetupIntentInput = z.infer<typeof createSetupIntentInputSchema>;

/** POST /api/booking/appointments request body (Phase 1) */
export const createAppointmentInputSchema = z.object({
  staffSlug: z.string(),
  serviceIds: z.array(z.string().uuid()).min(1),
  startsAt: z.string().datetime({ offset: true }),
  client: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
    smsOptIn: z.boolean().default(false),
    intakeNotes: z.string().max(1200).optional(),
    bookingPreferences: z.string().max(600).optional(),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Birthday must be YYYY-MM-DD")
      .optional(),
    addressLine1: z.string().min(1).max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    addressCity: z.string().min(1).max(100).optional(),
    addressState: z.string().min(2).max(2).optional(),
    addressZip: z.string().min(5).max(10).optional(),
    preferredContactMethod: preferredContactMethodSchema.optional(),
    referralSources: z
      .array(intakeReferralSourceSchema)
      .min(1, "Select at least one referral source")
      .optional(),
    isReturningClient: z.boolean().optional(),
  }),
  policyAcknowledged: z.literal(true),
  setupIntentId: z.string().min(1),
  /** Boulevard cart reservation — required when slot was held server-side */
  cartId: z.string().uuid().optional(),
  clientMessage: z.string().max(1200).optional(),
  referralSource: z.string().max(200).optional(),
})
  .superRefine((value, ctx) => {
    if (value.client.isReturningClient) return;

    const client = value.client;
    const required: Array<{ key: keyof typeof client; label: string }> = [
      { key: "birthday", label: "Birthday" },
      { key: "addressLine1", label: "Street address" },
      { key: "addressCity", label: "City" },
      { key: "addressState", label: "State" },
      { key: "addressZip", label: "ZIP code" },
      { key: "preferredContactMethod", label: "Preferred contact method" },
    ];

    for (const field of required) {
      const raw = client[field.key];
      if (raw == null || (typeof raw === "string" && !raw.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field.label} is required for new clients`,
          path: ["client", field.key],
        });
      }
    }

    if (!client.referralSources?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one referral source",
        path: ["client", "referralSources"],
      });
    }
  });
export type CreateAppointmentInput = z.infer<
  typeof createAppointmentInputSchema
>;

export const bookingPolicyDepositTypeSchema = z.enum([
  "none",
  "card_on_file",
  "fixed",
  "percent",
]);
export type BookingPolicyDepositType = z.infer<
  typeof bookingPolicyDepositTypeSchema
>;

/** PATCH /api/booking-policy request body (team managers) */
export const patchBookingPolicySettingsSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    cancellationWindowHours: z.number().int().min(1).max(168).optional(),
    lateCancelFeePercent: z.number().int().min(0).max(100).optional(),
    noShowFeePercent: z.number().int().min(0).max(100).optional(),
    lateGraceMinutes: z.number().int().min(0).max(120).optional(),
    sameWeekRescheduleWaivesFee: z.boolean().optional(),
    requiresCardOnFile: z.boolean().optional(),
    depositType: bookingPolicyDepositTypeSchema.optional(),
    depositValue: z.number().int().nonnegative().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const depositType = value.depositType;
    if (depositType !== "fixed" && depositType !== "percent") {
      return;
    }
    if (value.depositValue == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Deposit value is required for fixed or percent deposits",
        path: ["depositValue"],
      });
    }
  });
export type PatchBookingPolicySettingsInput = z.infer<
  typeof patchBookingPolicySettingsSchema
>;
