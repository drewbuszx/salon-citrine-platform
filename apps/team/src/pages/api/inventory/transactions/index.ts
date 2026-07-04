import type { APIRoute } from "astro";
import { jsonError, jsonOk, requireApiAuth } from "../../../../lib/api-calendar";
import {
  computeQuantityChange,
  type InventoryTransactionType,
} from "../../../../lib/api-inventory";

export const GET: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  const productId = String(
    context.url.searchParams.get("productId") ?? "",
  ).trim();
  const limitRaw = Number(context.url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.round(limitRaw), 1), 100)
    : 20;

  const { supabase } = auth;

  let query = supabase
    .from("inventory_transactions")
    .select(
      "id, product_id, staff_id, type, quantity_change, quantity_after, notes, created_at, staff ( name ), products ( name, unit )",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("inventory transactions list failed", error);
    return jsonError("Failed to load transactions", 500);
  }

  const transactions = (data ?? []).map((row) => {
    const staff = row.staff as { name: string } | { name: string }[] | null;
    const product = row.products as
      | { name: string; unit: string }
      | { name: string; unit: string }[]
      | null;
    const staffName = Array.isArray(staff) ? staff[0]?.name : staff?.name;
    const productName = Array.isArray(product)
      ? product[0]?.name
      : product?.name;
    const unit = Array.isArray(product) ? product[0]?.unit : product?.unit;

    return {
      id: row.id,
      productId: row.product_id,
      productName,
      unit,
      staffId: row.staff_id,
      staffName,
      type: row.type,
      quantityChange: Number(row.quantity_change),
      quantityAfter: Number(row.quantity_after),
      notes: row.notes,
      createdAt: row.created_at,
    };
  });

  return jsonOk({ transactions });
};

type CreateTransactionBody = {
  product_id?: string;
  type?: InventoryTransactionType;
  quantity?: number;
  quantity_change?: number;
  count?: number;
  notes?: string;
};

export const POST: APIRoute = async (context) => {
  const auth = await requireApiAuth(context);
  if (!auth.ok) return auth.response;

  let body: CreateTransactionBody;
  try {
    body = (await context.request.json()) as CreateTransactionBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const productId = String(body.product_id ?? "").trim();
  const type = body.type;
  const validTypes: InventoryTransactionType[] = [
    "receive",
    "use",
    "adjust",
    "count",
  ];

  if (!productId || !type || !validTypes.includes(type)) {
    return jsonError("Invalid product or transaction type", 400);
  }

  const { supabase, staff } = auth;

  const { data: stockRow, error: stockError } = await supabase
    .from("inventory_stock")
    .select("quantity")
    .eq("product_id", productId)
    .maybeSingle();

  if (stockError) {
    console.error("stock lookup failed", stockError);
    return jsonError("Failed to load stock", 500);
  }

  const currentQty = Number(stockRow?.quantity ?? 0);
  const changeResult = computeQuantityChange(type, currentQty, {
    quantity: body.quantity,
    quantityChange: body.quantity_change,
    count: body.count,
  });

  if (typeof changeResult === "object" && "error" in changeResult) {
    return jsonError(changeResult.error, 400);
  }

  const notes = String(body.notes ?? "").trim() || null;

  const { data: tx, error: txError } = await supabase
    .from("inventory_transactions")
    .insert({
      product_id: productId,
      staff_id: staff.id,
      type,
      quantity_change: changeResult,
      quantity_after: 0,
      notes,
    })
    .select(
      "id, product_id, staff_id, type, quantity_change, quantity_after, notes, created_at",
    )
    .single();

  if (txError || !tx) {
    console.error("inventory transaction insert failed", txError);
    if (txError?.message?.includes("Insufficient stock")) {
      return jsonError("Insufficient stock", 409);
    }
    return jsonError("Failed to log transaction", 500);
  }

  return jsonOk({
    transaction: {
      id: tx.id,
      productId: tx.product_id,
      staffId: tx.staff_id,
      type: tx.type,
      quantityChange: Number(tx.quantity_change),
      quantityAfter: Number(tx.quantity_after),
      notes: tx.notes,
      createdAt: tx.created_at,
    },
  });
};
