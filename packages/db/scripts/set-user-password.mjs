/**
 * Set a Supabase Auth user password (dev troubleshooting).
 * Usage: node packages/db/scripts/set-user-password.mjs <email> <password>
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "..", "..", ".env");

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
    // optional
  }
}

loadEnv(envPath);

const email = process.argv[2]?.trim();
const password = process.argv[3] ?? "";

if (!email || !password) {
  console.error("Usage: node set-user-password.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let page = 1;
let user = null;
while (!user) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (user || data.users.length < 200) break;
  page += 1;
}

if (!user) {
  console.error(`User not found: ${email}`);
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
  user_metadata: {
    ...user.user_metadata,
    must_change_password: false,
    email_verified: true,
  },
});

if (updateError) throw updateError;

console.log(`Password updated for ${email}`);
console.log("Sign in at http://localhost:4322/team/login");
