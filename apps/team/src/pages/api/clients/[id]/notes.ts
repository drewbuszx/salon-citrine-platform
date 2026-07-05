import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";

const noteSchema = z.object({
  body: z.string().min(1).max(4000),
  noteType: z.enum(["general", "formula", "preference"]).default("general"),
});

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const clientId = String(context.params.id ?? "");
  if (!clientId) return jsonError("Client id required", 400);

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
  }

  const { data, error } = await auth.supabase
    .from("client_notes")
    .insert({
      client_id: clientId,
      staff_id: auth.staff.id,
      note_type: parsed.data.noteType,
      body: parsed.data.body.trim(),
    })
    .select("id, note_type, body, created_at, staff(name)")
    .single();

  if (error || !data) {
    console.error("client note insert failed", error);
    return jsonError("Failed to add note", 500);
  }

  const staffRaw = data.staff as { name: string } | { name: string }[] | null;
  const staffName = Array.isArray(staffRaw) ? staffRaw[0]?.name : staffRaw?.name;

  return jsonOk({
    note: {
      id: data.id,
      noteType: data.note_type,
      body: data.body,
      createdAt: data.created_at,
      staffName: staffName ?? "",
    },
  });
};
