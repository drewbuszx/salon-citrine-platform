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

const allowedDuplicates = new Set(manifest.historicalDuplicatePrefixes);
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
  if (names.length > 1 && !allowedDuplicates.has(prefix)) {
    failures.push(`duplicate migration prefix ${prefix}: ${names.join(", ")}`);
  }
}

for (const prefix of allowedDuplicates) {
  if ((byPrefix.get(prefix)?.length ?? 0) < 2) {
    failures.push(`historical duplicate allow-list is stale: ${prefix}`);
  }
}

if (failures.length) {
  console.error(`Migration verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Verified ${actual.length} ordered migrations.`);
