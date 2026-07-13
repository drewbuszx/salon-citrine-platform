import { readFile } from "node:fs/promises";
import { evidencePath, migrationDigest } from "./migration-evidence.mjs";

const { digest, manifest, canonicalFileCount } = await migrationDigest();
let evidence;
try {
  evidence = JSON.parse(await readFile(evidencePath, "utf8"));
} catch {
  console.error(
    "DEPLOYMENT BLOCKED: disposable migration evidence is missing. Run npm run db:test:disposable.",
  );
  process.exit(1);
}

if (
  evidence.status !== "passed" ||
  evidence.migrationDigest !== digest ||
  evidence.migrationCount !== manifest.migrations.length ||
  evidence.canonicalFileCount !== canonicalFileCount
) {
  console.error(
    "DEPLOYMENT BLOCKED: migration evidence is stale or failed. Re-run npm run db:test:disposable.",
  );
  process.exit(1);
}
console.log("Disposable migration evidence matches the current migration set.");
