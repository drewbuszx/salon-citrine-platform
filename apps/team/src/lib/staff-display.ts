import { teamUrl } from "./supabase-server";

export function staffInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Resolve a staff photo for the team app (same rules as DayCalendar staffPhotoUrl). */
export function staffPhotoSrc(
  photoUrl: string | null | undefined,
  slug?: string,
): string | null {
  if (photoUrl) {
    if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
    const path = photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`;
    return teamUrl(path);
  }
  if (slug) {
    return teamUrl(`/images/${slug}.jpg`);
  }
  return null;
}
