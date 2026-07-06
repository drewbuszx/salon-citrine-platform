/** Resolved hex values so inline --staff-accent works reliably in color-mix(). */
export const STAFF_ACCENT_COLORS = [
  "#e7ac46", // citrine
  "#8d9e88", // sage
  "#d4a5a5",
  "#9cb4d4",
  "#c4b0d8",
  "#e8b8a8",
  "#8fbfb0",
] as const;

/** Stable accent color per staff member (independent of column order). */
export function staffAccentColor(staffId: string) {
  let hash = 0;
  for (let i = 0; i < staffId.length; i++) {
    hash = (hash * 31 + staffId.charCodeAt(i)) >>> 0;
  }
  return STAFF_ACCENT_COLORS[hash % STAFF_ACCENT_COLORS.length]!;
}
