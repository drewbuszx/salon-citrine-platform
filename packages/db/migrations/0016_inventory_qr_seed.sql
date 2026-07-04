-- QR / barcode test product for inventory check-in scanning.
-- Encode barcode value "QR-TEST-8500001234561" as a text QR code for mobile testing.

insert into public.products (
  id, name, sku, barcode, brand, category, unit, reorder_threshold, notes
) values (
  'a1000001-0000-4000-8000-000000000011',
  'QR Test — Wella Color Touch Sample',
  'QR-TEST',
  'QR-TEST-8500001234561',
  'Wella',
  'color',
  'tube',
  1,
  'Test product for QR scan check-in. QR encodes: QR-TEST-8500001234561'
)
on conflict (id) do nothing;

insert into public.inventory_stock (product_id, quantity)
values ('a1000001-0000-4000-8000-000000000011', 0)
on conflict (product_id) do nothing;
