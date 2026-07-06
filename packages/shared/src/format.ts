/**
 * Shared display formatting helpers.
 *
 * These are intentionally dependency-free so they can be imported from both
 * server code (Astro/Workers) and browser bundles (Astro `<script>` islands).
 */

/** Render a quantity: integers stay whole, fractional values show 2 decimals. */
export function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Pluralize a unit against a quantity: (1, "tube") -> "tube", (2, "tube") -> "tubes".
 * "each" is treated as invariant.
 */
export function pluralizeUnit(unit: string, qty: number): string {
  const u = (unit ?? "").trim();
  if (!u) return "";
  const lower = u.toLowerCase();
  if (lower === "each" || Math.abs(qty) === 1) return u;
  if (/(s|x|z|ch|sh)$/.test(lower)) return `${u}es`;
  if (/[^aeiou]y$/.test(lower)) return `${u.slice(0, -1)}ies`;
  return `${u}s`;
}

/** (2, "tube") -> "2 tubes"; (1, "tube") -> "1 tube". */
export function formatQuantity(qty: number, unit: string): string {
  return `${formatQty(qty)} ${pluralizeUnit(unit, qty)}`.trim();
}

/** "developer" -> "Developer"; "hair-color" / "hair_color" -> "Hair Color". */
export function formatCategoryLabel(
  value: string | null | undefined,
  fallback = "Uncategorized",
): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
