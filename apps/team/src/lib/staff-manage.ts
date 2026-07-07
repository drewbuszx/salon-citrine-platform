import type { StaffRole } from "../env.d.ts";

export const STAFF_MANAGE_SELECT =
  "id, slug, name, role, bio, phone, photo_url, photo_crop, is_bookable, accepting_new_clients, supabase_user_id, created_at, updated_at";

export type StaffManageRow = {
  id: string;
  slug: string;
  name: string;
  role: StaffRole;
  bio: string | null;
  phone: string | null;
  photo_url: string | null;
  photo_crop: { x: number; y: number; scale: number } | null;
  is_bookable: boolean;
  accepting_new_clients: boolean;
  supabase_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffManageItem = {
  id: string;
  slug: string;
  name: string;
  role: StaffRole;
  bio: string;
  phone: string;
  photoUrl: string | null;
  photoCrop: StaffManageRow["photo_crop"];
  isBookable: boolean;
  acceptingNewClients: boolean;
  isLinked: boolean;
  createdAt: string;
  updatedAt: string;
};

export const STAFF_ROLES: StaffRole[] = [
  "owner",
  "stylist",
  "esthetician",
  "front_desk",
];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  stylist: "Stylist",
  esthetician: "Esthetician",
  front_desk: "Front desk",
};

export function slugifyStaffName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mapStaffRow(row: StaffManageRow): StaffManageItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    role: row.role,
    bio: row.bio ?? "",
    phone: row.phone ?? "",
    photoUrl: row.photo_url,
    photoCrop: row.photo_crop,
    isBookable: row.is_bookable,
    acceptingNewClients: row.accepting_new_clients,
    isLinked: Boolean(row.supabase_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStaffCreateBody(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Name is required" as const };

  const role = typeof body.role === "string" ? body.role : "";
  if (!STAFF_ROLES.includes(role as StaffRole)) {
    return { error: "Invalid role" as const };
  }

  const slugInput = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = slugInput || slugifyStaffName(name);
  if (!slug) return { error: "Slug is required" as const };

  return {
    data: {
      name,
      slug,
      role: role as StaffRole,
      bio: typeof body.bio === "string" ? body.bio.trim() || null : null,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      is_bookable: body.isBookable !== false,
      accepting_new_clients: body.acceptingNewClients !== false,
    },
  };
}

export function mapStaffUpdateBody(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return { error: "Name is required" as const };
    updates.name = name;
  }

  if (typeof body.slug === "string") {
    const slug = body.slug.trim();
    if (!slug) return { error: "Slug is required" as const };
    updates.slug = slug;
  }

  if (typeof body.role === "string") {
    if (!STAFF_ROLES.includes(body.role as StaffRole)) {
      return { error: "Invalid role" as const };
    }
    updates.role = body.role;
  }

  if (typeof body.bio === "string") updates.bio = body.bio.trim() || null;
  if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
  if (typeof body.isBookable === "boolean") updates.is_bookable = body.isBookable;
  if (typeof body.acceptingNewClients === "boolean") {
    updates.accepting_new_clients = body.acceptingNewClients;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "No updates provided" as const };
  }

  return { data: updates };
}
