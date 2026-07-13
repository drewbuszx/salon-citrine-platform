import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import process from "node:process";
import { evidencePath, migrationDigest } from "./migration-evidence.mjs";

// Single orchestrator for disposable Postgres/Supabase replay. Evidence is written
// only after every child command exits 0; the required CI job is the authoritative
// attestation. Supabase is always stopped in a finally-style block.

function run(command, args, { allowFailure = false } = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
  return result.status ?? 1;
}

function detectSupabaseCliVersion() {
  const result = spawnSync("npx", ["--yes", "supabase@2.109.1", "--version"], {
    encoding: "utf8",
    shell: true,
  });
  return (result.stdout ?? "").trim() || "unknown";
}

const SUPABASE = ["--yes", "supabase@2.109.1"];

let started = false;
try {
  run("node", ["scripts/stage-canonical-migrations.mjs"]);
  run("node", ["scripts/verify-migrations.mjs"]);

  const cliVersion = detectSupabaseCliVersion();
  run("npx", [...SUPABASE, "start"]);
  started = true;
  run("npx", [...SUPABASE, "db", "reset"]);
  run("npx", [...SUPABASE, "test", "db", "tests"]);

  const { digest, manifest, canonicalFileCount } = await migrationDigest();
  const evidence = {
    status: "passed",
    migrationDigest: digest,
    migrationCount: manifest.migrations.length,
    canonicalFileCount,
    canonicalVersionBase: manifest.canonicalVersionBase,
    supabaseCli: cliVersion,
    gitSha: process.env.GITHUB_SHA ?? process.env.SC_GIT_SHA ?? "local",
    completedAt: new Date().toISOString(),
    checks: ["canonical-db-reset", "pgtap-security-suite"],
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`\nWrote disposable migration evidence: ${evidencePath}`);
} finally {
  if (started) {
    run("npx", [...SUPABASE, "stop", "--no-backup"], {
      allowFailure: true,
    });
  }
}
