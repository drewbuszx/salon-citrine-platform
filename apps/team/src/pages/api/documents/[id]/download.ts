import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import { TEAM_DOCUMENTS_BUCKET } from "../../../../lib/api-documents";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const documentId = context.params.id;
  if (!documentId) {
    return jsonError("Missing document id", 400);
  }

  const { supabase } = auth;

  const { data: doc, error } = await supabase
    .from("team_documents")
    .select("id, storage_path, file_name, is_active")
    .eq("id", documentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !doc) {
    return jsonError("Document not found", 404);
  }

  if (!doc.storage_path || doc.storage_path === "pending") {
    return jsonError("File not available yet", 404);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(TEAM_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 120);

  if (signError || !signed?.signedUrl) {
    console.error("document signed url failed", signError);
    return jsonError("Failed to generate download link", 500);
  }

  if (context.url.searchParams.get("redirect") === "1") {
    return Response.redirect(signed.signedUrl, 302);
  }

  return jsonOk({
    url: signed.signedUrl,
    fileName: doc.file_name,
    expiresIn: 120,
  });
};
