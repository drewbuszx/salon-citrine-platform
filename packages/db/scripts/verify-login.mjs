/**
 * Verify Supabase password sign-in for a dev account (local troubleshooting).
 * Usage: node packages/db/scripts/verify-login.mjs <email> <password>
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
  console.error("Usage: node verify-login.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, anon, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error("Sign-in failed:", error.message);
  process.exit(1);
}

console.log("Sign-in OK");
console.log("User ID:", data.user?.id ?? "(none)");
console.log("must_change_password:", data.user?.user_metadata?.must_change_password ?? false);
