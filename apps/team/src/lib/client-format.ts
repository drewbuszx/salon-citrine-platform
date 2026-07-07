/** Shared client display + normalization helpers (team clients directory). */

export function normalizePhoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function formatPhoneDisplay(value: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(value);
  if (!digits) return null;
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  const trimmed = value?.trim();
  return trimmed || null;
}

export type LtvDisplay = {
  label: string;
  title: string;
  kind: "value" | "zero" | "none";
};

/**
 * Central lifetime-value definition: LTV is the sum of completed sales
 * (`lifetime_value_cents`). Keep display/query/report consistent by reusing
 * this helper. The currency column always renders a numeric value ($0 when
 * there are no completed sales) — never prose — with the reason in `title`.
 */
export function formatLtvDisplay(
  cents: number | null | undefined,
  visitCount = 0,
): LtvDisplay {
  const value = (cents ?? 0) / 100;
  const label = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));

  if (value > 0) {
    return { label, title: "Lifetime value from completed sales", kind: "value" };
  }
  if (visitCount > 0) {
    return { label, title: "Visits on record, but no completed sales yet", kind: "zero" };
  }
  return { label, title: "No completed sales", kind: "none" };
}

export function clientInitials(firstName: string, lastName: string): string {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  const initials = `${first}${last}`.toUpperCase();
  return initials || "?";
}

export function pluralizeClients(count: number): string {
  const safe = Math.max(0, count);
  return safe === 1 ? "1 client" : `${safe.toLocaleString("en-US")} clients`;
}

export function preferredNameFromPreferences(
  firstName: string,
  bookingPreferences: string | null | undefined,
): string | null {
  const raw = bookingPreferences?.trim();
  if (!raw) return null;
  const goesBy = raw.match(/^goes by\s+(.+)$/i);
  if (goesBy?.[1]) return goesBy[1].trim();
  if (raw.includes("\n") || raw.length > 24) return null;
  if (raw.toLowerCase() === firstName.toLowerCase()) return null;
  return raw;
}
