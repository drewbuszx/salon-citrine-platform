/**
 * Create or update a dev admin Supabase Auth user and link to a staff row.
 * Dev only — requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in repo root .env.
 *
 * Usage:
 *   node packages/db/scripts/create-dev-admin.mjs <email>
 *   node packages/db/scripts/create-dev-admin.mjs <email> --link-staff=lily-gleitsman
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const envPath = join(repoRoot, ".env");

function loadEnv(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env optional if vars already exported
  }
}

function parseArgs(argv) {
  const email = argv[2]?.trim();
  if (!email || email.startsWith("-")) {
    console.error(
      "Usage: node packages/db/scripts/create-dev-admin.mjs <email> [--link-staff=slug]",
    );
    process.exit(1);
  }

  let linkStaff = "lily-gleitsman";
  for (const arg of argv.slice(3)) {
    if (arg.startsWith("--link-staff=")) {
      linkStaff = arg.slice("--link-staff=".length).trim();
    }
  }

  return { email, linkStaff };
}

function generateTempPassword() {
  return randomBytes(18).toString("base64url");
}

async function findUserByEmail(supabase, email) {
  const normalized = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === normalized,
    );
    if (user) return user;

    if (data.users.length < 200) return null;
    page += 1;
  }
}

loadEnv(envPath);

const { email, linkStaff } = parseArgs(process.argv);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const tempPassword = generateTempPassword();

let userId;
let created = false;

const existing = await findUserByEmail(supabase, email);
if (existing) {
  userId = existing.id;
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      ...existing.user_metadata,
      must_change_password: true,
    },
  });
  if (error) throw error;
  console.log(`Updated existing auth user: ${email}`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  });
  if (error) throw error;
  userId = data.user.id;
  created = true;
  console.log(`Created auth user: ${email}`);
}

const { data: staff, error: staffLookupError } = await supabase
  .from("staff")
  .select("id, slug, name, role, supabase_user_id")
  .eq("slug", linkStaff)
  .maybeSingle();

if (staffLookupError) throw staffLookupError;
if (!staff) {
  throw new Error(`Staff slug not found: ${linkStaff}`);
}

const { error: linkError } = await supabase
  .from("staff")
  .update({ supabase_user_id: userId, role: "owner" })
  .eq("slug", linkStaff);

if (linkError) throw linkError;

console.log("");
console.log("Dev admin setup complete.");
console.log(`  Email:       ${email}`);
console.log(`  User ID:     ${userId}`);
console.log(`  Staff:       ${staff.name} (${linkStaff})`);
console.log(`  Role:        owner`);
console.log(`  Auth action: ${created ? "created" : "updated existing user"}`);
console.log("");
console.log("Temporary password (shown once — save it now):");
console.log(`  ${tempPassword}`);
console.log("");
console.log("Sign in at http://localhost:4322/team/login");
console.log("You will be redirected to /team/change-password on first login.");
