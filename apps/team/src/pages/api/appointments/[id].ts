import type { APIRoute } from "astro";

import {

  canManageStaffColumn,

  jsonError,

  jsonOk,

  requireApiAuth,

} from "../../../lib/api-calendar";

import {

  mapOverlapDbError,

  validateAppointmentTimeRange,

} from "../../../lib/calendar-overlap";

import { cancelAppointmentWithPolicy } from "../../../lib/cancel-appointment";

import { isSalonManager } from "../../../lib/auth";

import { parseDateTimeLocalInput } from "../../../lib/datetime";



const ALLOWED_STATUSES = new Set([

  "pending",

  "confirmed",

  "completed",

  "cancelled",

  "no_show",

]);



type PatchAppointmentBody = {

  starts_at?: string;

  ends_at?: string;

  notes?: string;

  status?: string;

  staff_id?: string;

};



export const PATCH: APIRoute = async (context) => {

  const auth = await requireApiAuth(context);

  if (!auth.ok) return auth.response;



  const appointmentId = context.params.id;

  if (!appointmentId) {

    return jsonError("Missing appointment id", 400);

  }



  const { supabase, staff } = auth;



  const { data: existing, error: loadError } = await supabase

    .from("appointments")

    .select("id, staff_id, starts_at, ends_at, notes, status")

    .eq("id", appointmentId)

    .maybeSingle();



  if (loadError || !existing) {

    return jsonError("Appointment not found", 404);

  }



  if (!canManageStaffColumn(staff, existing.staff_id)) {

    return jsonError("Not allowed to edit this appointment", 403);

  }



  let body: PatchAppointmentBody;

  try {

    body = (await context.request.json()) as PatchAppointmentBody;

  } catch {

    return jsonError("Invalid JSON body", 400);

  }



  if (body.status === "cancelled" && existing.status !== "cancelled") {

    const cancelResult = await cancelAppointmentWithPolicy(supabase, appointmentId);

    if (!cancelResult.ok) {

      return jsonError(cancelResult.message, cancelResult.status);

    }

    return jsonOk({

      cancelFeeCents: cancelResult.cancelFeeCents,

      feeChargedCents: cancelResult.feeChargedCents,

    });

  }



  const updates: Record<string, string | null> = {};



  if (body.starts_at !== undefined) {

    try {

      updates.starts_at = parseDateTimeLocalInput(String(body.starts_at)).toISOString();

    } catch {

      return jsonError("Invalid starts_at", 400);

    }

  }



  if (body.ends_at !== undefined) {

    try {

      updates.ends_at = parseDateTimeLocalInput(String(body.ends_at)).toISOString();

    } catch {

      return jsonError("Invalid ends_at", 400);

    }

  }



  if (body.notes !== undefined) {

    updates.notes = String(body.notes).trim() || null;

  }



  let nextStaffId = existing.staff_id;



  if (body.staff_id !== undefined) {

    const staffId = String(body.staff_id).trim();

    if (!staffId) {

      return jsonError("Invalid staff_id", 400);

    }

    if (!canManageStaffColumn(staff, staffId)) {

      return jsonError("Not allowed to move appointment to this provider", 403);

    }

    nextStaffId = staffId;

    updates.staff_id = staffId;

  }



  if (body.status !== undefined) {

    const status = String(body.status);

    if (!ALLOWED_STATUSES.has(status)) {

      return jsonError("Invalid status", 400);

    }

    updates.status = status;

  }



  const nextStarts = updates.starts_at ?? existing.starts_at;

  const nextEnds = updates.ends_at ?? existing.ends_at;

  if (new Date(nextStarts) >= new Date(nextEnds)) {

    return jsonError("End time must be after start time", 400);

  }



  if (Object.keys(updates).length === 0) {

    return jsonError("No updates provided", 400);

  }



  const nextStatus = updates.status ?? existing.status;

  if (updates.starts_at !== undefined || updates.ends_at !== undefined || updates.status !== undefined || updates.staff_id !== undefined) {

    const validation = await validateAppointmentTimeRange(supabase, {

      staffId: nextStaffId,

      startsAt: new Date(nextStarts),

      endsAt: new Date(nextEnds),

      excludeAppointmentId: appointmentId,

      status: nextStatus,

      isManager: isSalonManager(staff),

    });

    if (!validation.ok) {

      return jsonError(validation.message, validation.status);

    }

  }



  const { error } = await supabase

    .from("appointments")

    .update(updates)

    .eq("id", appointmentId);



  if (error) {

    console.error("appointment update failed", error);

    const conflict = mapOverlapDbError(error);

    if (conflict) {

      return jsonError(conflict.message, conflict.status);

    }

    return jsonError("Could not update appointment", 500);

  }



  return jsonOk();

};



export const DELETE: APIRoute = async (context) => {

  const auth = await requireApiAuth(context);

  if (!auth.ok) return auth.response;



  const appointmentId = context.params.id;

  if (!appointmentId) {

    return jsonError("Missing appointment id", 400);

  }



  const { supabase, staff } = auth;



  const { data: existing, error: loadError } = await supabase

    .from("appointments")

    .select("id, staff_id")

    .eq("id", appointmentId)

    .maybeSingle();



  if (loadError || !existing) {

    return jsonError("Appointment not found", 404);

  }



  if (!canManageStaffColumn(staff, existing.staff_id)) {

    return jsonError("Not allowed to cancel this appointment", 403);

  }



  const cancelResult = await cancelAppointmentWithPolicy(supabase, appointmentId);

  if (!cancelResult.ok) {

    return jsonError(cancelResult.message, cancelResult.status);

  }



  return jsonOk({

    cancelFeeCents: cancelResult.cancelFeeCents,

    feeChargedCents: cancelResult.feeChargedCents,

  });

};


