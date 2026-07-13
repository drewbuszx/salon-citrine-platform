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

export type AccessAction =
  | "invite"
  | "resend"
  | "link"
  | "deactivate"
  | "reactivate";
export type AccessActionRequest = { action: AccessAction; authUserId?: string };

const ACCESS_ACTIONS: readonly AccessAction[] = [
  "invite",
  "resend",
  "link",
  "deactivate",
  "reactivate",
];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAccessActionRequest(value: unknown):
  | { ok: true; value: AccessActionRequest }
  | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Request body must be an object" };
  }
  const input = value as Record<string, unknown>;
  const unknown = Object.keys(input).filter(
    (key) => key !== "action" && key !== "authUserId",
  );
  if (unknown.length) {
    return { ok: false, error: "Unsupported access request field" };
  }
  const action = input.action;
  if (typeof action !== "string" || !ACCESS_ACTIONS.includes(action as AccessAction)) {
    return { ok: false, error: "Invalid access action" };
  }
  if (input.authUserId !== undefined && typeof input.authUserId !== "string") {
    return { ok: false, error: "authUserId must be a string" };
  }
  const authUserId = input.authUserId ? String(input.authUserId).trim() : undefined;
  if (action === "link") {
    if (!authUserId || !UUID_RE.test(authUserId)) {
      return { ok: false, error: "A valid Auth user id is required to link" };
    }
  } else if (authUserId !== undefined) {
    return { ok: false, error: "authUserId is only valid for the link action" };
  }
  return {
    ok: true,
    value: authUserId
      ? { action: action as AccessAction, authUserId }
      : { action: action as AccessAction },
  };
}

export type CapabilityPatchRequest = {
  role: string;
  capability: string;
  enabled: boolean;
};

/** Validate owner-only role capability PATCH bodies. */
export function parseCapabilityPatchRequest(
  value: unknown,
  options: {
    isKnownRole: (role: string) => boolean;
    isKnownCapability: (capability: string) => boolean;
  },
): { ok: true; value: CapabilityPatchRequest } | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Request body must be an object" };
  }
  const input = value as Record<string, unknown>;
  const unknown = Object.keys(input).filter(
    (key) => key !== "role" && key !== "capability" && key !== "enabled",
  );
  if (unknown.length) {
    return { ok: false, error: "Unsupported capability request field" };
  }
  if (typeof input.role !== "string" || !options.isKnownRole(input.role)) {
    return { ok: false, error: "Unknown role" };
  }
  if (
    typeof input.capability !== "string" ||
    !options.isKnownCapability(input.capability)
  ) {
    return { ok: false, error: "Unknown capability" };
  }
  if (typeof input.enabled !== "boolean") {
    return { ok: false, error: "Invalid enabled flag" };
  }
  return {
    ok: true,
    value: {
      role: input.role,
      capability: input.capability,
      enabled: input.enabled,
    },
  };
}

