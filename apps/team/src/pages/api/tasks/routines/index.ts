import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import { loadSalonRoutines } from "../../../../lib/api-routines";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  try {
    const routines = await loadSalonRoutines(auth.supabase);
    return jsonOk({ routines });
  } catch (error) {
    console.error("salon routines load failed", error);
    return jsonError("Failed to load salon routines", 500);
  }
};
