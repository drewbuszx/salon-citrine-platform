import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";
import {
  DOCUMENT_SELECT,
  mapDocument,
  parseCategory,
  requireManager,
  sanitizeFileName,
  storagePathForDocument,
  TEAM_DOCUMENTS_BUCKET,
  validateDocumentFile,
  type DocumentRow,
} from "../../../lib/api-documents";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const category = String(context.url.searchParams.get("category") ?? "").trim();
  const { supabase } = auth;

  let query = supabase
    .from("team_documents")
    .select(DOCUMENT_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("documents list failed", error);
    return jsonError("Failed to load documents", 500);
  }

  const documents = (data ?? []).map((row) => mapDocument(row as DocumentRow));
  return jsonOk({ documents });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const form = await context.request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  const categoryResult = parseCategory(form.get("category"));
  if (typeof categoryResult === "object" && categoryResult !== null && "error" in categoryResult) {
    return jsonError(categoryResult.error, 400);
  }
  const file = form.get("file");

  if (!title) {
    return jsonError("Title is required", 400);
  }

  if (!(file instanceof File) || file.size <= 0) {
    return jsonError("File is required", 400);
  }

  const fileError = validateDocumentFile(file);
  if (fileError) {
    return jsonError(fileError.error, 400);
  }

  const { supabase, staff } = auth;
  const fileName = sanitizeFileName(file.name);

  const { data: created, error: insertError } = await supabase
    .from("team_documents")
    .insert({
      title,
      description,
      category: categoryResult,
      storage_path: "pending",
      file_name: fileName,
      mime_type: file.type,
      file_size_bytes: file.size,
      uploaded_by_staff_id: staff.id,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    console.error("document insert failed", insertError);
    return jsonError("Failed to create document", 500);
  }

  const storagePath = storagePathForDocument(created.id, fileName);
  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(TEAM_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("document upload failed", uploadError);
    await supabase.from("team_documents").delete().eq("id", created.id);
    return jsonError("Failed to upload file", 500);
  }

  const { data: updated, error: updateError } = await supabase
    .from("team_documents")
    .update({ storage_path: storagePath })
    .eq("id", created.id)
    .select(DOCUMENT_SELECT)
    .single();

  if (updateError || !updated) {
    console.error("document path update failed", updateError);
    return jsonOk({ id: created.id });
  }

  return jsonOk({ document: mapDocument(updated as DocumentRow) });
};
