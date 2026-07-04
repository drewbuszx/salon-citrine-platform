import { isSalonManager } from "./auth";
import type { StaffProfile } from "../env.d.ts";

export const TEAM_DOCUMENTS_BUCKET = "team-documents";

export const DOCUMENT_CATEGORIES = [
  "policies",
  "training",
  "forms",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_by_staff_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export const DOCUMENT_SELECT = `
  id,
  title,
  description,
  category,
  storage_path,
  file_name,
  mime_type,
  file_size_bytes,
  uploaded_by_staff_id,
  is_active,
  created_at,
  updated_at,
  uploaded_by:staff!team_documents_uploaded_by_staff_id_fkey ( id, name )
`;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function relOne<T extends { id: string; name: string }>(
  value: T | T[] | null | undefined,
) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function requireManager(staff: StaffProfile) {
  return isSalonManager(staff);
}

export function parseCategory(value: unknown): DocumentCategory | null | { error: string } {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const category = String(value).trim() as DocumentCategory;
  if (!DOCUMENT_CATEGORIES.includes(category)) {
    return { error: "Invalid category" };
  }
  return category;
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return base.slice(0, 200) || "document";
}

export function validateDocumentFile(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Unsupported file type. Use PDF, Word, or image files." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "File must be 10 MB or smaller." };
  }
  if (file.size <= 0) {
    return { error: "File is empty." };
  }
  return null;
}

export function mapDocument(row: DocumentRow) {
  const uploadedBy = relOne(row.uploaded_by);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedByStaffId: row.uploaded_by_staff_id,
    uploadedByName: uploadedBy?.name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };
}

export function storagePathForDocument(documentId: string, fileName: string) {
  return `documents/${documentId}/${sanitizeFileName(fileName)}`;
}
