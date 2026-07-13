import type { User } from "@supabase/supabase-js";

type AuthUserLister = {
  auth: {
    admin: {
      listUsers(input: {
        page: number;
        perPage: number;
      }): Promise<{ data: { users: User[] }; error: { message: string } | null }>;
    };
  };
};

export async function findAuthUserByEmail(
  admin: AuthUserLister,
  email: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const perPage = 100;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Auth user lookup failed: ${error.message}`);
    const matches = data.users.filter(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    if (matches.length > 1) {
      throw new Error("Multiple Auth users share the employee email");
    }
    if (matches[0]) return matches[0];
    if (data.users.length < perPage) return null;
  }
  throw new Error("Auth user lookup exceeded the safe pagination limit");
}

export function reusablePendingInviteError(
  user: Pick<User, "invited_at" | "last_sign_in_at" | "user_metadata">,
  staffId: string,
): string | null {
  if (!user.invited_at || user.last_sign_in_at) {
    return "existing_account";
  }
  const metadataStaffId = user.user_metadata?.staff_id;
  if (metadataStaffId && metadataStaffId !== staffId) {
    return "different_employee";
  }
  return null;
}
