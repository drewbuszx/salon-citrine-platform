import { isSalonManager } from "./auth";
import type { StaffProfile } from "../env.d.ts";

export type InventoryTransactionType = "receive" | "use" | "adjust" | "count";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category: string | null;
  unit: string;
  reorder_threshold: number;
  is_active: boolean;
  notes: string | null;
  inventory_stock: { quantity: number } | { quantity: number }[] | null;
};

export function mapProduct(row: ProductRow) {
  const stock = row.inventory_stock;
  const quantity = Array.isArray(stock)
    ? (stock[0]?.quantity ?? 0)
    : (stock?.quantity ?? 0);
  const reorderThreshold = Number(row.reorder_threshold ?? 0);

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    brand: row.brand,
    category: row.category,
    unit: row.unit,
    reorderThreshold,
    isActive: row.is_active,
    notes: row.notes,
    quantity,
    isLowStock: reorderThreshold > 0 && quantity <= reorderThreshold,
  };
}

export function requireManager(staff: StaffProfile) {
  return isSalonManager(staff);
}

export function computeQuantityChange(
  type: InventoryTransactionType,
  currentQty: number,
  body: {
    quantity?: number;
    quantityChange?: number;
    count?: number;
  },
): number | { error: string } {
  if (type === "receive") {
    const amount = Number(body.quantity ?? 1);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Quantity must be a positive number" };
    }
    return amount;
  }

  if (type === "use") {
    const amount = Number(body.quantity ?? 1);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Quantity must be a positive number" };
    }
    return -amount;
  }

  if (type === "adjust") {
    const change =
      body.quantityChange !== undefined
        ? Number(body.quantityChange)
        : Number(body.quantity);
    if (!Number.isFinite(change) || change === 0) {
      return { error: "Adjustment requires a non-zero quantity change" };
    }
    return change;
  }

  const count = Number(body.count);
  if (!Number.isFinite(count) || count < 0) {
    return { error: "Count must be zero or greater" };
  }
  return count - currentQty;
}
