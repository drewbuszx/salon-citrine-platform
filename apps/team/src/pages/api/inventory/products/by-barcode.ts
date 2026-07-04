import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import { mapProduct, type ProductRow } from "../../../../lib/api-inventory";

const PRODUCT_SELECT =
  "id, name, sku, barcode, brand, category, unit, reorder_threshold, is_active, notes, inventory_stock ( quantity )";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const code = String(context.url.searchParams.get("code") ?? "").trim();
  if (!code) {
    return jsonError("Barcode is required", 400);
  }

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("barcode", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("barcode lookup failed", error);
    return jsonError("Failed to look up barcode", 500);
  }

  if (!data) {
    return jsonOk({ product: null, barcode: code });
  }

  return jsonOk({ product: mapProduct(data as ProductRow), barcode: code });
};
