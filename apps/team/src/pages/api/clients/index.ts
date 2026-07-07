import type { APIRoute } from "astro";
import { jsonError, jsonOk, jsonResponse, requireApiAuth } from "../../../lib/api-calendar";
import { normalizeEmail, normalizePhoneDigits } from "../../../lib/client-format";

type CreateClientBody = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  forceCreate?: boolean;
};

async function findPossibleDuplicates(
  supabase: App.Locals["supabase"],
  phone: string | null,
  email: string | null,
) {
  const matches = new Map<string, { id: string; fullName: string; phone: string | null; email: string | null }>();

  if (phone) {
    const digits = normalizePhoneDigits(phone);
    if (digits.length >= 7) {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone, email")
        .ilike("phone", `%${digits.slice(-10)}%`)
        .limit(5);
      for (const row of data ?? []) {
        const rowDigits = normalizePhoneDigits(row.phone);
        if (rowDigits === digits || rowDigits.endsWith(digits) || digits.endsWith(rowDigits)) {
          matches.set(row.id, {
            id: row.id,
            fullName: `${row.first_name} ${row.last_name}`.trim(),
            phone: row.phone,
            email: row.email,
          });
        }
      }
    }
  }

  if (email) {
    const normalized = normalizeEmail(email);
    if (normalized) {
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone, email")
        .ilike("email", normalized)
        .limit(5);
      for (const row of data ?? []) {
        if (normalizeEmail(row.email) === normalized) {
          matches.set(row.id, {
            id: row.id,
            fullName: `${row.first_name} ${row.last_name}`.trim(),
            phone: row.phone,
            email: row.email,
          });
        }
      }
    }
  }

  return [...matches.values()];
}

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  let body: CreateClientBody;
  try {
    body = (await context.request.json()) as CreateClientBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim() || null;
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const forceCreate = body.forceCreate === true;

  if (!firstName || !lastName) {
    return jsonError("First and last name are required", 400);
  }

  if (!forceCreate && (phone || email)) {
    const possibleDuplicates = await findPossibleDuplicates(auth.supabase, phone, email);
    if (possibleDuplicates.length > 0) {
      return jsonResponse({ ok: true, possibleDuplicates, client: null }, 409);
    }
  }

  const { data, error } = await auth.supabase
    .from("clients")
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
    })
    .select("id, first_name, last_name, phone, email")
    .single();

  if (error || !data) {
    console.error("client create failed", error);
    return jsonError("Failed to create client", 500);
  }

  return jsonOk({
    client: {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      fullName: `${data.first_name} ${data.last_name}`.trim(),
      phone: data.phone,
      email: data.email,
    },
    possibleDuplicates: [],
  });
};
