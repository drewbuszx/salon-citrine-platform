import { writeFile } from "node:fs/promises";
import { evidencePath, migrationDigest } from "./migration-evidence.mjs";

// This writer must only ever run as the final step of the orchestrated
// `db:test:disposable` pipeline, after `supabase db reset` and `supabase test db`
// have both succeeded. It refuses to self-certify when invoked directly, so a
// developer cannot fabricate deployment evidence by running it alone.
if (process.env.SC_DISPOSABLE_REPLAY_OK !== "1") {
  console.error(
    "Refusing to write migration evidence: SC_DISPOSABLE_REPLAY_OK is not set. " +
      "This script only runs inside `npm run db:test:disposable` after a successful replay.",
  );
  process.exit(1);
}

const { digest, manifest, canonicalFileCount } = await migrationDigest();
const evidence = {
  status: "passed",
  migrationDigest: digest,
  migrationCount: manifest.migrations.length,
  canonicalFileCount,
  canonicalVersionBase: manifest.canonicalVersionBase,
  supabaseCli: process.env.SC_SUPABASE_CLI_VERSION ?? "unknown",
  gitSha: process.env.GITHUB_SHA ?? process.env.SC_GIT_SHA ?? "local",
  legacyReconciliations: manifest.legacyReconciliations.map((entry) => ({
    legacyVersion: entry.legacyVersion,
    files: entry.files.map(({ file, canonicalVersion }) => ({
      file,
      canonicalVersion,
    })),
  })),
  completedAt: new Date().toISOString(),
  checks: ["canonical-db-reset", "pgtap-security-suite"],
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote disposable migration evidence: ${evidencePath}`);
