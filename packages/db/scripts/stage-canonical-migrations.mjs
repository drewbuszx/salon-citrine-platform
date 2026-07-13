import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(dbRoot, "../..");

// The canonical version numbers are deliberately synthetic and do NOT match the real
// production migration ledger. Staging them into supabase/migrations is only safe for
// a local, disposable database. Refuse to run when a linked remote project or a
// remote database URL is present, so `supabase db push` can never target production
// with this reconciled-but-not-production history.
async function assertNoRemoteTarget() {
  if (process.env.SUPABASE_DB_URL || process.env.SUPABASE_PROJECT_REF) {
    throw new Error(
      "Refusing to stage canonical migrations while a remote Supabase target is configured.",
    );
  }
  try {
    await access(path.join(repoRoot, "supabase", ".temp", "project-ref"));
    throw new Error(
      "Refusing to stage canonical migrations: a linked Supabase project ref was found.",
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
  }
}

await assertNoRemoteTarget();
const manifest = JSON.parse(
  await readFile(path.join(dbRoot, "migration-manifest.json"), "utf8"),
);
const output = path.join(repoRoot, "supabase", "migrations");
const base = BigInt(manifest.canonicalVersionBase);
const explicit = new Map(
  manifest.legacyReconciliations.flatMap((group) =>
    group.files.map((entry) => [entry.file, entry.canonicalVersion]),
  ),
);
const shimsByAfter = new Map(
  manifest.disposableShims.map((shim) => [shim.after, shim]),
);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let insertedShims = 0;
for (const [index, file] of manifest.migrations.entries()) {
  const generated = String(base + BigInt(index + 1 + insertedShims)).padStart(14, "0");
  const canonicalVersion = explicit.get(file) ?? generated;
  if (canonicalVersion !== generated) {
    throw new Error(
      `Canonical mapping drift for ${file}: expected sequence ${generated}, got ${canonicalVersion}`,
    );
  }
  // Supabase CLI skips any migration filename containing "init" (reserved). Rewrite
  // the staged suffix so disposable replay actually applies 0001_init.sql.
  let suffix = file.replace(/^\d{4}_/, "");
  if (/\binit\b/i.test(suffix) || /(^|_)init(\.|_)/i.test(suffix)) {
    suffix = suffix.replace(/init/gi, "schema_bootstrap");
  }
  const stagedName = `${canonicalVersion}_${suffix}`;
  if (/init/i.test(stagedName)) {
    throw new Error(
      `Staged migration name still contains "init" (Supabase would skip it): ${stagedName}`,
    );
  }
  await cp(
    path.join(dbRoot, "migrations", file),
    path.join(output, stagedName),
  );
  const shim = shimsByAfter.get(file);
  if (shim) {
    insertedShims += 1;
    const expectedShimVersion = String(
      base + BigInt(index + 1 + insertedShims),
    ).padStart(14, "0");
    if (shim.canonicalVersion !== expectedShimVersion) {
      throw new Error(
        `Shim mapping drift for ${shim.file}: expected ${expectedShimVersion}, got ${shim.canonicalVersion}`,
      );
    }
    await cp(
      path.join(dbRoot, shim.file),
      path.join(
        output,
        `${shim.canonicalVersion}_${path.basename(shim.file)}`,
      ),
    );
  }
}

console.log(
  `Staged ${manifest.migrations.length} canonical migrations and ${insertedShims} reconciliation shim(s) in ${output}.`,
);
