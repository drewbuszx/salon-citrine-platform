#!/usr/bin/env node
/**
 * Build apps/web against a running local Supabase stack that already has
 * canonical migrations applied (after `npm run stage:migrations` + `db reset`,
 * or immediately after a successful disposable replay before stop).
 *
 * Uses the well-known local demo JWTs from Supabase docs (not production secrets).
 * Does not print keys. Requires Docker + `npx supabase@2.109.1 start`.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const demoAnon =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const demoService =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const env = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? demoAnon,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? demoService,
};

console.log(`Building apps/web against ${env.SUPABASE_URL} (keys not printed)`);
const result = spawnSync("npm", ["run", "build", "--workspace", "apps/web"], {
  env,
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
