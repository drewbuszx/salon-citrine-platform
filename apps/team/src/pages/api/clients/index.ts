import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../lib/api-calendar";

type CreateClientBody = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
};

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

  if (!firstName || !lastName) {
    return jsonError("First and last name are required", 400);
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
  });
};
