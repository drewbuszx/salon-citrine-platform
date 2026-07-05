/**
 * Bulk-update product image_url from a CSV file.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in repo root .env.
 *
 * Usage:
 *   node packages/db/scripts/import-product-images.mjs path/to/images.csv
 *   node packages/db/scripts/import-product-images.mjs path/to/images.csv --dry-run
 *
 * CSV columns (header row required):
 *   image_url — required on every row
 *   barcode | sku | id — at least one identifier column per row
 *
 * Example CSV:
 *   barcode,image_url
 *   012345678905,https://example.com/shampoo.jpg
 *   987654321098,https://xyz.supabase.co/storage/v1/object/public/product-images/abc/photo.jpg
 *
 * Upload path pattern for Supabase Storage (product-images bucket):
 *   {product_id}/photo.{jpg|png|webp}
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

/** Minimal RFC4180-ish CSV parser (handles quoted fields). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function parseArgs(argv) {
  const csvPath = argv[2]?.trim();
  if (!csvPath || csvPath.startsWith("-")) {
    console.error(
      "Usage: node packages/db/scripts/import-product-images.mjs <csv-file> [--dry-run]",
    );
    process.exit(1);
  }
  const dryRun = argv.includes("--dry-run");
  return { csvPath: resolve(csvPath), dryRun };
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

loadEnv(envPath);

const { csvPath, dryRun } = parseArgs(process.argv);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env");
}

const csvText = readFileSync(csvPath, "utf8");
const table = parseCsv(csvText);
if (table.length < 2) {
  throw new Error("CSV must include a header row and at least one data row");
}

const headers = table[0].map(normalizeHeader);
const imageUrlIdx = headers.indexOf("image_url");
if (imageUrlIdx === -1) {
  throw new Error('CSV must include an "image_url" column');
}

const idIdx = headers.indexOf("id");
const skuIdx = headers.indexOf("sku");
const barcodeIdx = headers.indexOf("barcode");
if (idIdx === -1 && skuIdx === -1 && barcodeIdx === -1) {
  throw new Error('CSV must include at least one of: "id", "sku", or "barcode"');
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let updated = 0;
let skipped = 0;
let failed = 0;

for (let line = 1; line < table.length; line += 1) {
  const cells = table[line];
  const imageUrl = (cells[imageUrlIdx] ?? "").trim();
  if (!imageUrl) {
    console.warn(`Row ${line + 1}: skipped — missing image_url`);
    skipped += 1;
    continue;
  }

  const id = idIdx >= 0 ? (cells[idIdx] ?? "").trim() : "";
  const sku = skuIdx >= 0 ? (cells[skuIdx] ?? "").trim() : "";
  const barcode = barcodeIdx >= 0 ? (cells[barcodeIdx] ?? "").trim() : "";

  if (!id && !sku && !barcode) {
    console.warn(`Row ${line + 1}: skipped — no id, sku, or barcode`);
    skipped += 1;
    continue;
  }

  let query = supabase.from("products").select("id, name, barcode, sku, image_url");
  if (id) {
    query = query.eq("id", id);
  } else if (barcode) {
    query = query.eq("barcode", barcode);
  } else {
    query = query.eq("sku", sku);
  }

  const { data: matches, error: lookupError } = await query;
  if (lookupError) {
    console.error(`Row ${line + 1}: lookup failed — ${lookupError.message}`);
    failed += 1;
    continue;
  }

  if (!matches?.length) {
    const label = id || barcode || sku;
    console.warn(`Row ${line + 1}: no product found for ${label}`);
    skipped += 1;
    continue;
  }

  if (matches.length > 1) {
    console.warn(`Row ${line + 1}: multiple products matched — skipped`);
    skipped += 1;
    continue;
  }

  const product = matches[0];
  if (product.image_url === imageUrl) {
    console.log(`Row ${line + 1}: ${product.name} — already set`);
    skipped += 1;
    continue;
  }

  if (dryRun) {
    console.log(`Row ${line + 1}: [dry-run] would update ${product.name} → ${imageUrl}`);
    updated += 1;
    continue;
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", product.id);

  if (updateError) {
    console.error(`Row ${line + 1}: update failed — ${updateError.message}`);
    failed += 1;
    continue;
  }

  console.log(`Row ${line + 1}: updated ${product.name}`);
  updated += 1;
}

console.log("");
console.log(`Done.${dryRun ? " (dry run)" : ""}`);
console.log(`  Updated: ${updated}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Failed:  ${failed}`);

if (failed > 0) process.exit(1);
