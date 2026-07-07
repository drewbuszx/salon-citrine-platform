import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  countAttentionTasks,
  isTaskNeedsAttention,
  mapTask,
  parseAssignmentType,
  parseDueAt,
  parsePriority,
  requireManager,
  TASK_SELECT,
  type TaskRow,
} from "../../../lib/api-tasks";

type CreateTaskBody = {
  title?: string;
  description?: string;
  due_at?: string | null;
  priority?: string;
  assignment_type?: string;
  assignee_ids?: string[];
};

async function loadAssigneeTaskIds(
  supabase: App.Locals["supabase"],
  staffId: string,
) {
  const { data, error } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("staff_id", staffId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.task_id as string);
}

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const view = String(context.url.searchParams.get("view") ?? "my").trim();
  const manager = requireManager(staff);

  let attentionCount = 0;
  try {
    attentionCount = await countAttentionTasks(supabase, staff.id, manager);
  } catch (error) {
    console.error("task attention count failed", error);
  }

  let query = supabase.from("tasks").select(TASK_SELECT);

  if (view === "all") {
    if (!manager) {
      return jsonError("Forbidden", 403);
    }
    query = query
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false });
  } else if (view === "available") {
    query = query
      .eq("assignment_type", "open")
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false });
  } else if (view === "attention") {
    query = query
      .in("status", ["open", "claimed"])
      .not("due_at", "is", null)
      .order("due_at", { ascending: true, nullsFirst: false });
  } else if (view === "completed") {
    query = query.eq("status", "done").order("completed_at", {
      ascending: false,
    });

    if (!manager) {
      let assigneeTaskIds: string[] = [];
      try {
        assigneeTaskIds = await loadAssigneeTaskIds(supabase, staff.id);
      } catch (error) {
        console.error("task assignee lookup failed", error);
        return jsonError("Failed to load tasks", 500);
      }

      if (assigneeTaskIds.length > 0) {
        query = query.or(
          `completed_by_staff_id.eq.${staff.id},id.in.(${assigneeTaskIds.join(",")})`,
        );
      } else {
        query = query.eq("completed_by_staff_id", staff.id);
      }
    }
  } else {
    let assigneeTaskIds: string[] = [];
    try {
      assigneeTaskIds = await loadAssigneeTaskIds(supabase, staff.id);
    } catch (error) {
      console.error("task assignee lookup failed", error);
      return jsonError("Failed to load tasks", 500);
    }

    if (assigneeTaskIds.length === 0) {
      return jsonOk({ tasks: [], view, attentionCount });
    }

    query = query
      .in("id", assigneeTaskIds)
      .in("status", ["open", "claimed"])
      .order("due_at", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("tasks list failed", error);
    return jsonError("Failed to load tasks", 500);
  }

  let tasks = (data ?? []).map((row) => mapTask(row as TaskRow, staff.id));

  if (view === "attention") {
    tasks = tasks.filter((task) => isTaskNeedsAttention(task.dueAt, task.status as TaskRow["status"]));
    if (!manager) {
      tasks = tasks.filter(
        (task) =>
          task.assignmentType === "open" ||
          task.assignees.some((a) => a.staffId === staff.id),
      );
    }
  }

  return jsonOk({ tasks, view, attentionCount });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  let body: CreateTaskBody;
  try {
    body = (await context.request.json()) as CreateTaskBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const title = String(body.title ?? "").trim();
  if (!title) {
    return jsonError("Title is required", 400);
  }

  const assignmentType = parseAssignmentType(body.assignment_type);
  if (typeof assignmentType === "object" && "error" in assignmentType) {
    return jsonError(assignmentType.error, 400);
  }

  const priority = parsePriority(body.priority);
  if (typeof priority === "object" && "error" in priority) {
    return jsonError(priority.error, 400);
  }

  const dueAt = parseDueAt(body.due_at);
  if (typeof dueAt === "object" && dueAt !== null && "error" in dueAt) {
    return jsonError(dueAt.error, 400);
  }

  const assigneeIds = Array.isArray(body.assignee_ids)
    ? [...new Set(body.assignee_ids.map(String).filter(Boolean))]
    : [];

  if (assignmentType === "assigned" && assigneeIds.length === 0) {
    return jsonError("Select at least one team member", 400);
  }

  if (assignmentType === "open" && assigneeIds.length > 0) {
    return jsonError("Open tasks cannot have assignees at creation", 400);
  }

  const description = String(body.description ?? "").trim() || null;
  const { supabase, staff } = auth;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title,
      description,
      assignment_type: assignmentType,
      priority,
      due_at: dueAt,
      created_by_staff_id: staff.id,
      status: "open",
    })
    .select("id")
    .single();

  if (taskError || !task) {
    console.error("task insert failed", taskError);
    return jsonError("Failed to create task", 500);
  }

  if (assignmentType === "assigned") {
    const { error: assigneeError } = await supabase.from("task_assignees").insert(
      assigneeIds.map((staffId) => ({
        task_id: task.id,
        staff_id: staffId,
      })),
    );

    if (assigneeError) {
      console.error("task assignees insert failed", assigneeError);
      await supabase.from("tasks").delete().eq("id", task.id);
      return jsonError("Failed to assign task", 500);
    }
  }

  const { data: created, error: loadError } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", task.id)
    .single();

  if (loadError || !created) {
    return jsonOk({ task: { id: task.id } });
  }

  return jsonOk({ task: mapTask(created as TaskRow, staff.id) });
};
