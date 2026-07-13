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

  // Claiming is an atomic, narrowly scoped RPC: it only inserts the assignee and
  // flips status to claimed. Direct table UPDATE access has been revoked so no other
  // task columns can be mutated during a claim.
  const { error: claimError } = await supabase.rpc("claim_task", {
    p_task_id: taskId,
  });

  if (claimError) {
    console.error("task claim failed", claimError);
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
