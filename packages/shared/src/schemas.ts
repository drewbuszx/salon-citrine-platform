import { z } from "zod";

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
  "pending",
  "confirmed",
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
  }),
  policyAcknowledged: z.literal(true),
  setupIntentId: z.string().min(1),
});
export type CreateAppointmentInput = z.infer<
  typeof createAppointmentInputSchema
>;
