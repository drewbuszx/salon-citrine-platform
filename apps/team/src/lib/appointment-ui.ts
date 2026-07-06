/** Presentation helpers for calendar appointment cards and panels. */

export type AppointmentStatusMeta = {
  label: string;
  shortLabel: string;
  icon: string;
};

const STATUS_META: Record<string, AppointmentStatusMeta> = {
  booked: { label: "Booked", shortLabel: "Booked", icon: "○" },
  pending: { label: "Unconfirmed", shortLabel: "Pending", icon: "?" },
  confirmed: { label: "Confirmed", shortLabel: "Confirmed", icon: "✓" },
  arrived: { label: "Arrived", shortLabel: "Arrived", icon: "→" },
  completed: { label: "Completed", shortLabel: "Done", icon: "✓" },
  cancelled: { label: "Canceled", shortLabel: "Canceled", icon: "×" },
  no_show: { label: "No show", shortLabel: "No show", icon: "!" },
};

export function appointmentStatusMeta(status: string): AppointmentStatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status.replace(/_/g, " "),
      shortLabel: status.replace(/_/g, " "),
      icon: "•",
    }
  );
}

/** Map service category to card accent color (not provider identity). */
const CATEGORY_COLOR_RULES: Array<{ test: (c: string) => boolean; color: string }> =
  [
    { test: (c) => c === "Haircuts", color: "#7eb8da" },
    { test: (c) => c.startsWith("Color"), color: "#c9a0dc" },
    { test: (c) => c.includes("Treatment"), color: "#8fb996" },
    { test: (c) => c.includes("Extension"), color: "#d4a574" },
    { test: (c) => c.includes("Skin") || c.includes("Facial"), color: "#e8b4a0" },
    { test: (c) => c.includes("Wax"), color: "#b8c9e8" },
    { test: (c) => c.includes("Makeup"), color: "#e8a0c4" },
  ];

export function serviceCategoryColor(category: string | null | undefined) {
  if (!category) return "#b8a898";
  const rule = CATEGORY_COLOR_RULES.find((entry) => entry.test(category));
  return rule?.color ?? "#b8a898";
}

/** Readable service title — avoids shouting ALL CAPS from legacy data. */
export function formatServiceDisplayName(name: string) {
  if (!name) return "";
  const letters = name.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return name;
  const upperCount = (name.match(/[A-Z]/g) ?? []).length;
  if (upperCount / letters.length <= 0.65) return name;

  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (["and", "with", "the", "a", "an", "of", "in", "on", "at", "to", "for"].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatAppointmentStatusLabel(status: string) {
  return appointmentStatusMeta(status).label;
}
