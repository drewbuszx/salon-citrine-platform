import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import {
  isStaffAssignee,
  mapTask,
  TASK_SELECT,
  type TaskRow,
} from "../../../../lib/api-tasks";

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const taskId = context.params.id;
  if (!taskId) {
    return jsonError("Missing task id", 400);
  }

  const { supabase, staff } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Task not found", 404);
  }

  const task = existing as TaskRow;

  if (task.assignment_type !== "open" || task.status !== "open") {
    return jsonError("Task is not available to claim", 400);
  }

  if ((task.task_assignees ?? []).length > 0) {
    return jsonError("Task was already claimed", 400);
  }

  if (isStaffAssignee(task, staff.id)) {
    return jsonError("You already claimed this task", 400);
  }

  const claimedAt = new Date().toISOString();

  const { error: assigneeError } = await supabase.from("task_assignees").insert({
    task_id: taskId,
    staff_id: staff.id,
    claimed_at: claimedAt,
  });

  if (assigneeError) {
    console.error("task claim assignee failed", assigneeError);
    return jsonError("Failed to claim task", 500);
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "claimed" })
    .eq("id", taskId);

  if (updateError) {
    console.error("task claim status failed", updateError);
    await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", taskId)
      .eq("staff_id", staff.id);
    return jsonError("Failed to claim task", 500);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .single();

  if (refreshError || !refreshed) {
    return jsonOk({ id: taskId, claimed: true });
  }

  return jsonOk({ task: mapTask(refreshed as TaskRow, staff.id) });
};
