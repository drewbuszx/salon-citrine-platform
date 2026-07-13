export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "unavailable"
  | "internal_error";

export type ApiSuccess<T extends Record<string, unknown>> = { ok: true } & T;
export type ApiFailure = {
  ok: false;
  error: string;
  code?: ApiErrorCode;
};
export type ApiResponse<T extends Record<string, unknown>> =
  | ApiSuccess<T>
  | ApiFailure;

export type ActiveApiResource =
  | "tasks"
  | "routines"
  | "events"
  | "documents"
  | "staff"
  | "business"
  | "account"
  | "alerts";

export type CompleteTaskRequest = { completion_notes?: string };
export type CompleteTaskResponse = ApiResponse<{
  task?: Record<string, unknown>;
  id?: string;
  completed?: true;
}>;

export function parseCompleteTaskRequest(value: unknown):
  | { ok: true; value: CompleteTaskRequest }
  | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: {} };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be an object" };
  }
  const input = value as Record<string, unknown>;
  const unknown = Object.keys(input).filter((key) => key !== "completion_notes");
  if (unknown.length) return { ok: false, error: "Unsupported task completion field" };
  if (
    input.completion_notes !== undefined &&
    typeof input.completion_notes !== "string"
  ) {
    return { ok: false, error: "completion_notes must be a string" };
  }
  const notes = String(input.completion_notes ?? "").trim();
  if (notes.length > 2000) {
    return { ok: false, error: "completion_notes is too long" };
  }
  return { ok: true, value: notes ? { completion_notes: notes } : {} };
}
