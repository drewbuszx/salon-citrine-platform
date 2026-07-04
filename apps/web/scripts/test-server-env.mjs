import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libDir = path.resolve(__dirname, "../src/lib");

// Current (buggy) path — 3 levels up from lib
const buggyRoot = path.resolve(libDir, "../../..");
// Fixed path — 4 levels up from lib (monorepo root)
const fixedRoot = path.resolve(libDir, "../../../..");

const mode = process.env.NODE_ENV ?? "development";

for (const [label, root] of [
  ["buggy (../../..)", buggyRoot],
  ["fixed (../../../..)", fixedRoot],
]) {
  const loaded = loadEnv(mode, root, "");
  const key = loaded.RESEND_API_KEY;
  console.log(`${label}: root=${root}`);
  console.log(`  RESEND_API_KEY present: ${Boolean(key)}`);
  if (key) console.log(`  RESEND_API_KEY prefix: ${key.slice(0, 6)}...`);
  console.log(`  RESEND_FROM_EMAIL: ${loaded.RESEND_FROM_EMAIL ?? "(missing)"}`);
}
