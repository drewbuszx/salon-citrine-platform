import { BUSINESS } from "@saloncitrine/shared";

export function staffInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function staffPhotoSrc(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  const path = photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`;
  return `https://${BUSINESS.domain}${path}`;
}
