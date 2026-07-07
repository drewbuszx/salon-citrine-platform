import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../../../lib/api-calendar";
import {
  isRoutineSlug,
  loadSalonRoutines,
  setRoutineItemCompletion,
} from "../../../../../../lib/api-routines";

type PatchBody = {
  completed?: boolean;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const slug = String(context.params.slug ?? "").trim();
  const itemId = String(context.params.itemId ?? "").trim();

  if (!isRoutineSlug(slug)) {
    return jsonError("Invalid routine", 400);
  }

  if (!itemId) {
    return jsonError("Item id is required", 400);
  }

  let body: PatchBody;
  try {
    body = (await context.request.json()) as PatchBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (typeof body.completed !== "boolean") {
    return jsonError("completed must be a boolean", 400);
  }

  try {
    const routines = await loadSalonRoutines(auth.supabase);
    const routine = routines.find((entry) => entry.slug === slug);
    const item = routine?.items.find((entry) => entry.id === itemId);

    if (!routine || !item) {
      return jsonError("Routine item not found", 404);
    }

    await setRoutineItemCompletion(
      auth.supabase,
      auth.staff.id,
      itemId,
      body.completed,
      routine.salonDate,
    );

    const updated = await loadSalonRoutines(auth.supabase, routine.salonDate);
    const nextRoutine = updated.find((entry) => entry.slug === slug);

    return jsonOk({
      routine: nextRoutine ?? null,
      routines: updated,
    });
  } catch (error) {
    console.error("salon routine item update failed", error);
    return jsonError("Failed to update checklist item", 500);
  }
};
