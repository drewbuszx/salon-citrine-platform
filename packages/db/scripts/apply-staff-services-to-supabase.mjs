/**
 * Apply staff_services rows to Supabase using service role key from repo .env
 * Run: node scripts/apply-staff-services-to-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
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

loadEnv(envPath);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env");
}

const dataPath = join(__dirname, "..", "seed", "data", "staff-services-glossgenius.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));

const rows = [];
for (const staff of data.staff) {
  for (const svc of staff.services) {
    rows.push({ staff_id: staff.staff_id, service_id: svc.service_id });
  }
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("Deleting existing staff_services...");
const { error: delError } = await supabase.from("staff_services").delete().neq("staff_id", "00000000-0000-0000-0000-000000000000");
if (delError) throw delError;

console.log(`Inserting ${rows.length} rows...`);
const chunkSize = 100;
for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const { error } = await supabase.from("staff_services").insert(chunk);
  if (error) throw error;
  console.log(`  inserted ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
}

console.log("Done.");
