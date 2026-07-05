export type CheckoutLineKind = "service" | "product" | "tip" | "discount";

export type CheckoutOrderStatus = "open" | "completed" | "void";

export type CheckoutLineItem = {
  id?: string;
  kind: CheckoutLineKind;
  serviceId?: string | null;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  sortOrder?: number;
};

export type CheckoutOrder = {
  id: string;
  appointmentId: string | null;
  clientId: string;
  staffId: string;
  status: CheckoutOrderStatus;
  subtotalCents: number;
  tipCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositAppliedCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  lineItems: CheckoutLineItem[];
};

export type ClientNoteType = "general" | "formula" | "preference";

export type ClientProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  intakeNotes: string | null;
  bookingPreferences: string | null;
  staffNotes: string | null;
  formulaNotes: string | null;
  tags: string[];
  visitCount: number;
  lastVisitAt: string | null;
  lifetimeValueCents: number;
  smsOptIn: boolean;
  emailOptIn: boolean;
};

export function calculateCheckoutTotals(input: {
  lineItems: CheckoutLineItem[];
  tipCents?: number;
  discountCents?: number;
  taxCents?: number;
  depositAppliedCents?: number;
}): {
  subtotalCents: number;
  tipCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  depositAppliedCents: number;
  amountDueCents: number;
} {
  const subtotalCents = input.lineItems.reduce(
    (sum, item) => sum + Math.max(0, item.totalCents),
    0,
  );
  const tipCents = Math.max(0, input.tipCents ?? 0);
  const discountCents = Math.max(0, input.discountCents ?? 0);
  const taxCents = Math.max(0, input.taxCents ?? 0);
  const totalCents = Math.max(
    0,
    subtotalCents + tipCents + taxCents - discountCents,
  );
  const depositAppliedCents = Math.max(0, input.depositAppliedCents ?? 0);
  const amountDueCents = Math.max(0, totalCents - depositAppliedCents);

  return {
    subtotalCents,
    tipCents,
    discountCents,
    taxCents,
    totalCents,
    depositAppliedCents,
    amountDueCents,
  };
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}
