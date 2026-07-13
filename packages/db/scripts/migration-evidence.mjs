import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const dbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = path.resolve(dbRoot, "../..");
export const evidencePath = path.join(dbRoot, "migration-validation-evidence.json");

// Everything that materially affects a disposable replay is bound into the digest,
// so changing a shim, a pgTAP test, the Supabase config, or a staging script
// invalidates prior "passed" evidence.
async function hashFileInto(hash, label, absolutePath) {
  hash.update(label);
  hash.update(await readFile(absolutePath));
}

export async function migrationDigest() {
  const manifestText = await readFile(
    path.join(dbRoot, "migration-manifest.json"),
    "utf8",
  );
  const manifest = JSON.parse(manifestText);
  const hash = createHash("sha256").update(manifestText);

  for (const file of manifest.migrations) {
    await hashFileInto(hash, file, path.join(dbRoot, "migrations", file));
  }
  for (const shim of manifest.disposableShims) {
    await hashFileInto(hash, `shim:${shim.file}`, path.join(dbRoot, shim.file));
  }

  // Bind every pgTAP suite under tests/ (0030, 0034–0038, and any newer), not only 0030.
  const testDir = path.join(dbRoot, "tests");
  const testFiles = (await readdir(testDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of testFiles) {
    await hashFileInto(hash, `tests/${file}`, path.join(testDir, file));
  }

  for (const rel of [
    "scripts/stage-canonical-migrations.mjs",
    "scripts/verify-migrations.mjs",
    "scripts/run-disposable-replay.mjs",
    "scripts/verify-deployment-readiness.mjs",
  ]) {
    await hashFileInto(hash, rel, path.join(dbRoot, rel));
  }
  try {
    await hashFileInto(
      hash,
      "supabase/config.toml",
      path.join(repoRoot, "supabase", "config.toml"),
    );
  } catch {
    // config is optional in non-disposable contexts
  }

  const canonicalFileCount =
    manifest.migrations.length + manifest.disposableShims.length;
  return {
    digest: hash.digest("hex"),
    manifest,
    canonicalFileCount,
    boundPgTapFiles: testFiles,
  };
}
