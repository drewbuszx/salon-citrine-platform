import {
  calculateCheckoutTotals,
  type CheckoutLineItem,
  type CheckoutOrder,
} from "@saloncitrine/shared";

type SupabaseClient = App.Locals["supabase"];

type AppointmentCheckoutRow = {
  id: string;
  client_id: string;
  staff_id: string;
  location_id: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  deposit_charged_cents: number | null;
  checkout_order_id: string | null;
  clients: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    stripe_customer_id: string | null;
  } | null;
  staff: { id: string; name: string } | null;
  appointment_services: Array<{
    service_id: string;
    price_cents: number | null;
    services: { name: string; base_price_cents: number | null } | null;
  }> | null;
};

export async function loadAppointmentForCheckout(
  supabase: SupabaseClient,
  appointmentId: string,
) {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id,
      client_id,
      staff_id,
      location_id,
      status,
      starts_at,
      ends_at,
      deposit_charged_cents,
      checkout_order_id,
      clients (
        id,
        first_name,
        last_name,
        email,
        phone,
        stripe_customer_id
      ),
      staff ( id, name ),
      appointment_services (
        service_id,
        price_cents,
        services ( name, base_price_cents )
      )
    `,
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) throw error;
  return data as AppointmentCheckoutRow | null;
}

function mapLineRow(row: {
  id: string;
  kind: CheckoutLineItem["kind"];
  service_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  sort_order: number;
}): CheckoutLineItem {
  return {
    id: row.id,
    kind: row.kind,
    serviceId: row.service_id,
    productId: row.product_id,
    name: row.name,
    quantity: Number(row.quantity),
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
    sortOrder: row.sort_order,
  };
}

export async function getOrCreateCheckoutOrder(
  supabase: SupabaseClient,
  appointment: AppointmentCheckoutRow,
): Promise<CheckoutOrder> {
  if (appointment.checkout_order_id) {
    const existing = await loadCheckoutOrder(supabase, appointment.checkout_order_id);
    if (existing && existing.status === "open") return existing;
  }

  const lineItems: CheckoutLineItem[] = [];
  let sort = 0;
  for (const row of appointment.appointment_services ?? []) {
    const svc = row.services;
    const unitPrice =
      row.price_cents ?? svc?.base_price_cents ?? 0;
    lineItems.push({
      kind: "service",
      serviceId: row.service_id,
      name: svc?.name ?? "Service",
      quantity: 1,
      unitPriceCents: unitPrice,
      totalCents: unitPrice,
      sortOrder: sort++,
    });
  }

  const depositApplied = Math.max(0, appointment.deposit_charged_cents ?? 0);
  const totals = calculateCheckoutTotals({
    lineItems,
    depositAppliedCents: depositApplied,
  });

  const { data: order, error: orderError } = await supabase
    .from("checkout_orders")
    .insert({
      appointment_id: appointment.id,
      client_id: appointment.client_id,
      staff_id: appointment.staff_id,
      location_id: appointment.location_id,
      status: "open",
      subtotal_cents: totals.subtotalCents,
      tip_cents: totals.tipCents,
      discount_cents: totals.discountCents,
      tax_cents: totals.taxCents,
      total_cents: totals.totalCents,
      deposit_applied_cents: totals.depositAppliedCents,
      amount_paid_cents: 0,
    })
    .select("id")
    .single();

  if (orderError || !order) throw orderError ?? new Error("Failed to create order");

  const { error: linesError } = await supabase.from("checkout_line_items").insert(
    lineItems.map((item, index) => ({
      order_id: order.id,
      kind: item.kind,
      service_id: item.serviceId ?? null,
      product_id: item.productId ?? null,
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      total_cents: item.totalCents,
      sort_order: item.sortOrder ?? index,
    })),
  );

  if (linesError) throw linesError;

  await supabase
    .from("appointments")
    .update({ checkout_order_id: order.id })
    .eq("id", appointment.id);

  const loaded = await loadCheckoutOrder(supabase, order.id);
  if (!loaded) throw new Error("Failed to load checkout order");
  return loaded;
}

export async function loadCheckoutOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<CheckoutOrder | null> {
  const { data: order, error } = await supabase
    .from("checkout_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const { data: lines, error: linesError } = await supabase
    .from("checkout_line_items")
    .select("*")
    .eq("order_id", orderId)
    .order("sort_order");

  if (linesError) throw linesError;

  const lineItems = (lines ?? []).map((row) =>
    mapLineRow(row as Parameters<typeof mapLineRow>[0]),
  );
  const totals = calculateCheckoutTotals({
    lineItems,
    tipCents: order.tip_cents,
    discountCents: order.discount_cents,
    taxCents: order.tax_cents,
    depositAppliedCents: order.deposit_applied_cents,
  });

  return {
    id: order.id,
    appointmentId: order.appointment_id,
    clientId: order.client_id,
    staffId: order.staff_id,
    status: order.status,
    subtotalCents: totals.subtotalCents,
    tipCents: totals.tipCents,
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    depositAppliedCents: totals.depositAppliedCents,
    amountDueCents: totals.amountDueCents,
    amountPaidCents: order.amount_paid_cents,
    lineItems,
  };
}

export async function syncCheckoutOrderLines(
  supabase: SupabaseClient,
  orderId: string,
  lineItems: CheckoutLineItem[],
  tipCents: number,
): Promise<CheckoutOrder> {
  await supabase.from("checkout_line_items").delete().eq("order_id", orderId);

  const { error: insertError } = await supabase.from("checkout_line_items").insert(
    lineItems.map((item, index) => ({
      order_id: orderId,
      kind: item.kind,
      service_id: item.serviceId ?? null,
      product_id: item.productId ?? null,
      name: item.name,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      total_cents: item.totalCents,
      sort_order: item.sortOrder ?? index,
    })),
  );

  if (insertError) throw insertError;

  const totals = calculateCheckoutTotals({
    lineItems,
    tipCents,
    depositAppliedCents: (
      await supabase
        .from("checkout_orders")
        .select("deposit_applied_cents")
        .eq("id", orderId)
        .single()
    ).data?.deposit_applied_cents ?? 0,
  });

  const { error: updateError } = await supabase
    .from("checkout_orders")
    .update({
      subtotal_cents: totals.subtotalCents,
      tip_cents: totals.tipCents,
      total_cents: totals.totalCents,
    })
    .eq("id", orderId);

  if (updateError) throw updateError;

  const loaded = await loadCheckoutOrder(supabase, orderId);
  if (!loaded) throw new Error("Failed to reload checkout order");
  return loaded;
}

export async function completeCheckoutOrder(
  supabase: SupabaseClient,
  input: {
    orderId: string;
    appointmentId: string;
    amountPaidCents: number;
    stripePaymentIntentId: string | null;
    staffId: string;
    productLineItems: CheckoutLineItem[];
  },
): Promise<void> {
  const { error: orderError } = await supabase
    .from("checkout_orders")
    .update({
      status: "completed",
      amount_paid_cents: input.amountPaidCents,
      stripe_payment_intent_id: input.stripePaymentIntentId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.orderId);

  if (orderError) throw orderError;

  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", input.appointmentId);

  if (apptError) throw apptError;

  for (const item of input.productLineItems) {
    if (item.kind !== "product" || !item.productId) continue;
    const qty = item.quantity;
    if (qty <= 0) continue;

    const { error: txError } = await supabase.from("inventory_transactions").insert({
      product_id: item.productId,
      staff_id: input.staffId,
      type: "use",
      quantity_change: -qty,
      quantity_after: 0,
      notes: `Checkout order ${input.orderId}`,
    });

    if (txError) {
      console.error("checkout inventory use failed", txError);
    }
  }

  const { data: order } = await supabase
    .from("checkout_orders")
    .select("client_id")
    .eq("id", input.orderId)
    .single();

  if (order?.client_id) {
    await supabase.rpc("refresh_client_visit_stats", {
      p_client_id: order.client_id,
    });
  }
}

export async function loadRetailProducts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, retail_price_cents, inventory_stock ( quantity )")
    .eq("is_active", true)
    .not("retail_price_cents", "is", null)
    .order("name");

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const stock = row.inventory_stock as
        | { quantity: number }
        | Array<{ quantity: number }>
        | null;
      const quantity = Array.isArray(stock)
        ? (stock[0]?.quantity ?? 0)
        : (stock?.quantity ?? 0);
      return {
        id: row.id as string,
        name: row.name as string,
        brand: row.brand as string | null,
        category: row.category as string | null,
        retailPriceCents: row.retail_price_cents as number,
        quantity,
      };
    })
    .filter((p) => p.retailPriceCents > 0);
}
