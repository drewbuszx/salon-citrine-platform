import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  DOCUMENT_SELECT,
  mapDocument,
  parseCategory,
  requireManager,
  TEAM_DOCUMENTS_BUCKET,
  type DocumentRow,
} from "../../../lib/api-documents";

type PatchBody = {
  title?: string;
  description?: string | null;
  category?: string | null;
  is_active?: boolean;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const documentId = context.params.id;
  if (!documentId) {
    return jsonError("Missing document id", 400);
  }

  let body: PatchBody;
  try {
    body = (await context.request.json()) as PatchBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return jsonError("Title is required", 400);
    }
    updates.title = title;
  }

  if (body.description !== undefined) {
    updates.description = String(body.description ?? "").trim() || null;
  }

  if (body.category !== undefined) {
    const category = parseCategory(body.category);
    if (typeof category === "object" && category !== null && "error" in category) {
      return jsonError(category.error, 400);
    }
    updates.category = category;
  }

  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No updates provided", 400);
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("team_documents")
    .update(updates)
    .eq("id", documentId)
    .select(DOCUMENT_SELECT)
    .single();

  if (error || !data) {
    console.error("document update failed", error);
    return jsonError("Failed to update document", 500);
  }

  return jsonOk({ document: mapDocument(data as DocumentRow) });
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const documentId = context.params.id;
  if (!documentId) {
    return jsonError("Missing document id", 400);
  }

  const { supabase } = auth;

  const { data: existing, error: loadError } = await supabase
    .from("team_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (loadError || !existing) {
    return jsonError("Document not found", 404);
  }

  const soft = context.url.searchParams.get("soft") === "1";

  if (soft) {
    const { error } = await supabase
      .from("team_documents")
      .update({ is_active: false })
      .eq("id", documentId);

    if (error) {
      console.error("document soft delete failed", error);
      return jsonError("Failed to remove document", 500);
    }

    return jsonOk({ id: documentId, deactivated: true });
  }

  if (existing.storage_path && existing.storage_path !== "pending") {
    const { error: storageError } = await supabase.storage
      .from(TEAM_DOCUMENTS_BUCKET)
      .remove([existing.storage_path]);

    if (storageError) {
      console.error("document storage delete failed", storageError);
    }
  }

  const { error } = await supabase.from("team_documents").delete().eq("id", documentId);

  if (error) {
    console.error("document delete failed", error);
    return jsonError("Failed to delete document", 500);
  }

  return jsonOk({ id: documentId, deleted: true });
};
