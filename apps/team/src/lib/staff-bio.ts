export type BioStatus = "none" | "pending" | "approved" | "declined";

export type StaffBioFields = {
  bio: string | null;
  bio_pending: string | null;
  bio_status: BioStatus;
  bio_submitted_at: string | null;
  bio_reviewed_at: string | null;
  bio_review_note: string | null;
};

export function normalizeBioStatus(value: unknown): BioStatus {
  if (
    value === "none" ||
    value === "pending" ||
    value === "approved" ||
    value === "declined"
  ) {
    return value;
  }
  return "none";
}

export function bioStatusLabel(status: BioStatus): string {
  switch (status) {
    case "pending":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined — edit & resubmit";
    default:
      return "No bio submitted";
  }
}

/** Text shown in the bio editor textarea. */
export function bioEditorValue(fields: Pick<StaffBioFields, "bio" | "bio_pending" | "bio_status">): string {
  if (fields.bio_status === "pending" || fields.bio_status === "declined") {
    return fields.bio_pending ?? fields.bio ?? "";
  }
  return fields.bio_pending ?? fields.bio ?? "";
}

export function sanitizeBioInput(raw: unknown, maxLen = 2000): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return null;
  return trimmed;
}
