import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import {
  mapProduct,
  requireManager,
  type ProductRow,
} from "../../../../lib/api-inventory";

const PRODUCT_SELECT =
  "id, name, sku, barcode, brand, category, unit, reorder_threshold, is_active, notes, inventory_stock ( quantity )";

type UpdateProductBody = {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  category?: string | null;
  unit?: string;
  reorder_threshold?: number;
  notes?: string | null;
  is_active?: boolean;
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  const productId = context.params.id;
  if (!productId) {
    return jsonError("Product id is required", 400);
  }

  let body: UpdateProductBody;
  try {
    body = (await context.request.json()) as UpdateProductBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return jsonError("Product name cannot be empty", 400);
    updates.name = name;
  }
  if (body.sku !== undefined) {
    updates.sku = body.sku ? String(body.sku).trim() : null;
  }
  if (body.barcode !== undefined) {
    updates.barcode = body.barcode ? String(body.barcode).trim() : null;
  }
  if (body.brand !== undefined) {
    updates.brand = body.brand ? String(body.brand).trim() : null;
  }
  if (body.category !== undefined) {
    updates.category = body.category ? String(body.category).trim() : null;
  }
  if (body.unit !== undefined) {
    const unit = String(body.unit).trim();
    if (!unit) return jsonError("Unit cannot be empty", 400);
    updates.unit = unit;
  }
  if (body.reorder_threshold !== undefined) {
    const threshold = Number(body.reorder_threshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      return jsonError("Invalid reorder threshold", 400);
    }
    updates.reorder_threshold = threshold;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes ? String(body.notes).trim() : null;
  }
  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("No fields to update", 400);
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .select(PRODUCT_SELECT)
    .maybeSingle();

  if (error) {
    console.error("product update failed", error);
    if (error.code === "23505") {
      return jsonError("SKU or barcode already exists", 409);
    }
    return jsonError("Failed to update product", 500);
  }

  if (!data) {
    return jsonError("Product not found", 404);
  }

  return jsonOk({ product: mapProduct(data as ProductRow) });
};
