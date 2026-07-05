import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import {
  groupProductsByCategory,
  mapProduct,
  PRODUCT_SELECT,
  requireManager,
  type ProductRow,
} from "../../../../lib/api-inventory";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const { supabase } = auth;
  const q = String(context.url.searchParams.get("q") ?? "").trim();
  const lowStockOnly = context.url.searchParams.get("lowStockOnly") === "1";
  const includeInactive =
    context.url.searchParams.get("includeInactive") === "1" &&
    requireManager(auth.staff);

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  if (q.length >= 1) {
    const term = q.replace(/,/g, " ").trim();
    query = query.or(
      `name.ilike.%${term}%,brand.ilike.%${term}%,sku.ilike.%${term}%,barcode.ilike.%${term}%,category.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("inventory products list failed", error);
    return jsonError("Failed to load products", 500);
  }

  let products = (data ?? []).map((row) => mapProduct(row as ProductRow));
  const lowStockCount = products.filter((p) => p.isLowStock).length;

  if (lowStockOnly) {
    products = products.filter((p) => p.isLowStock);
  }

  const categories = groupProductsByCategory(products);

  return jsonOk({ products, categories, lowStockCount });
};

type CreateProductBody = {
  name?: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  category?: string;
  unit?: string;
  reorder_threshold?: number;
  image_url?: string;
  notes?: string;
  initial_quantity?: number;
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  if (!requireManager(auth.staff)) {
    return jsonError("Forbidden", 403);
  }

  let body: CreateProductBody;
  try {
    body = (await context.request.json()) as CreateProductBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return jsonError("Product name is required", 400);
  }

  const sku = String(body.sku ?? "").trim() || null;
  const barcode = String(body.barcode ?? "").trim() || null;
  const brand = String(body.brand ?? "").trim() || null;
  const category = String(body.category ?? "").trim() || null;
  const unit = String(body.unit ?? "each").trim() || "each";
  const notes = String(body.notes ?? "").trim() || null;
  const imageUrl = String(body.image_url ?? "").trim() || null;
  const reorderThreshold = Number(body.reorder_threshold ?? 0);
  const initialQuantity = Number(body.initial_quantity ?? 0);

  if (!Number.isFinite(reorderThreshold) || reorderThreshold < 0) {
    return jsonError("Invalid reorder threshold", 400);
  }

  if (!Number.isFinite(initialQuantity) || initialQuantity < 0) {
    return jsonError("Invalid initial quantity", 400);
  }

  const { supabase, staff } = auth;

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      name,
      sku,
      barcode,
      brand,
      category,
      unit,
      reorder_threshold: reorderThreshold,
      image_url: imageUrl,
      notes,
    })
    .select(PRODUCT_SELECT)
    .single();

  if (productError || !product) {
    console.error("product insert failed", productError);
    if (productError?.code === "23505") {
      return jsonError("SKU or barcode already exists", 409);
    }
    return jsonError("Failed to create product", 500);
  }

  await supabase
    .from("inventory_stock")
    .insert({ product_id: product.id, quantity: 0 });

  if (initialQuantity > 0) {
    const { error: txError } = await supabase
      .from("inventory_transactions")
      .insert({
        product_id: product.id,
        staff_id: staff.id,
        type: "receive",
        quantity_change: initialQuantity,
        quantity_after: 0,
        notes: "Initial stock",
      });

    if (txError) {
      console.error("initial inventory transaction failed", txError);
      return jsonError("Product created but initial stock failed", 500);
    }
  }

  const { data: refreshed } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", product.id)
    .single();

  return jsonOk({
    product: mapProduct((refreshed ?? product) as ProductRow),
  });
};
