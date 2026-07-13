import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(root, "migration-manifest.json"), "utf8"),
);
const actual = (await readdir(path.join(root, "migrations")))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const expected = manifest.migrations;
const failures = [];

if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  failures.push(
    `manifest mismatch\nexpected: ${expected.join(", ")}\nactual:   ${actual.join(", ")}`,
  );
}

const reconciliations = new Map(
  manifest.legacyReconciliations.map((entry) => [entry.legacyVersion, entry]),
);
const byPrefix = new Map();
for (const name of actual) {
  const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(name);
  if (!match) {
    failures.push(`invalid migration filename: ${name}`);
    continue;
  }
  const entries = byPrefix.get(match[1]) ?? [];
  entries.push(name);
  byPrefix.set(match[1], entries);
}

for (const [prefix, names] of byPrefix) {
  if (names.length <= 1) continue;
  const reconciliation = reconciliations.get(prefix);
  if (!reconciliation) {
    failures.push(`unreconciled duplicate migration prefix ${prefix}: ${names.join(", ")}`);
    continue;
  }
  const mappedNames = reconciliation.files.map((entry) => entry.file).sort();
  if (JSON.stringify(names.sort()) !== JSON.stringify(mappedNames)) {
    failures.push(`duplicate migration mapping mismatch for ${prefix}`);
  }
  if (reconciliation.status !== "requires_disposable_validation") {
    failures.push(`duplicate ${prefix} must remain blocked until disposable validation`);
  }
}

const canonicalVersions = new Set();
for (const [prefix, reconciliation] of reconciliations) {
  if ((byPrefix.get(prefix)?.length ?? 0) < 2) {
    failures.push(`stale reconciliation for non-duplicate prefix ${prefix}`);
  }
  for (const entry of reconciliation.files) {
    if (!/^\d{14}$/.test(entry.canonicalVersion)) {
      failures.push(`invalid canonical version for ${entry.file}`);
    }
    if (canonicalVersions.has(entry.canonicalVersion)) {
      failures.push(`duplicate canonical version ${entry.canonicalVersion}`);
    }
    canonicalVersions.add(entry.canonicalVersion);
    if (!Array.isArray(entry.requiredObjects) || entry.requiredObjects.length === 0) {
      failures.push(`missing object evidence for ${entry.file}`);
    }
  }
}

const explicitCanonical = new Map(
  manifest.legacyReconciliations.flatMap((group) =>
    group.files.map((entry) => [entry.file, entry.canonicalVersion]),
  ),
);
const shimByAfter = new Map(
  manifest.disposableShims.map((shim) => [shim.after, shim]),
);
const allCanonical = new Set();
let insertedShims = 0;
const base = BigInt(manifest.canonicalVersionBase);
for (const [index, file] of manifest.migrations.entries()) {
  const expectedVersion = String(
    base + BigInt(index + 1 + insertedShims),
  ).padStart(14, "0");
  if (
    explicitCanonical.has(file) &&
    explicitCanonical.get(file) !== expectedVersion
  ) {
    failures.push(`canonical sequence mismatch for ${file}`);
  }
  if (allCanonical.has(expectedVersion)) {
    failures.push(`duplicate staged canonical version ${expectedVersion}`);
  }
  allCanonical.add(expectedVersion);
  const shim = shimByAfter.get(file);
  if (shim) {
    insertedShims += 1;
    const expectedShimVersion = String(
      base + BigInt(index + 1 + insertedShims),
    ).padStart(14, "0");
    if (shim.canonicalVersion !== expectedShimVersion) {
      failures.push(`canonical shim sequence mismatch for ${shim.file}`);
    }
    if (allCanonical.has(expectedShimVersion)) {
      failures.push(`duplicate shim canonical version ${expectedShimVersion}`);
    }
    allCanonical.add(expectedShimVersion);
  }
}

if (failures.length) {
  console.error(`Migration verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `Verified ${actual.length} migrations; legacy duplicates are deterministically mapped but deployment-blocked pending disposable validation.`,
);
