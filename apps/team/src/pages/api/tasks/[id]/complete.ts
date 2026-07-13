import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import {
  mapTask,
  TASK_SELECT,
  type TaskRow,
} from "../../../../lib/api-tasks";
import { parseCompleteTaskRequest } from "../../../../lib/api-contract";

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const taskId = context.params.id;
  if (!taskId) {
    return jsonError("Missing task id", 400);
  }

  let body: unknown = {};
  try {
    const raw = await context.request.text();
    if (raw.trim()) {
      body = JSON.parse(raw);
    }
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const parsed = parseCompleteTaskRequest(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { supabase, staff } = auth;

  const completionNotes = parsed.value.completion_notes ?? null;
  const { error: updateError } = await supabase.rpc("complete_task", {
    p_task_id: taskId,
    p_completion_notes: completionNotes,
  });

  if (updateError) {
    console.error("task complete failed", updateError);
    return jsonError("Failed to complete task", 500);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (refreshError || !refreshed) {
    return jsonOk({ id: taskId, completed: true });
  }

  return jsonOk({ task: mapTask(refreshed as TaskRow, staff.id) });
};
