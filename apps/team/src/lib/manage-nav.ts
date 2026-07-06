import { teamUrl } from "./supabase-server";

export type ManageSection =
  | "hub"
  | "services"
  | "products"
  | "booking-policy"
  | "staff"
  | "tags"
  | "business";

export type ManageNavItem = {
  id: ManageSection;
  label: string;
  href: string;
  disabled?: boolean;
};

export const MANAGE_NAV: ManageNavItem[] = [
  { id: "services", label: "Services", href: teamUrl("/services") },
  { id: "products", label: "Products", href: teamUrl("/inventory") },
  { id: "staff", label: "Employees", href: teamUrl("/manage#staff"), disabled: true },
  { id: "booking-policy", label: "Booking Policy", href: teamUrl("/booking-policy") },
  { id: "tags", label: "Tags", href: teamUrl("/manage#tags"), disabled: true },
  { id: "business", label: "Business Details", href: teamUrl("/manage#business"), disabled: true },
];

export type ManageHubItem = {
  id: ManageSection;
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
  disabled?: boolean;
};

export const MANAGE_HUB_ITEMS: ManageHubItem[] = [
  {
    id: "services",
    title: "Services",
    description: "Service menu, durations, and stylist assignments.",
    href: teamUrl("/services"),
    actionLabel: "Open",
  },
  {
    id: "products",
    title: "Products",
    description: "Retail inventory, barcodes, and stock levels.",
    href: teamUrl("/inventory"),
    actionLabel: "Open",
  },
  {
    id: "booking-policy",
    title: "Booking Policy",
    description: "Cancellation windows, deposits, and guest messaging.",
    href: teamUrl("/booking-policy"),
    actionLabel: "Configure",
  },
  {
    id: "staff",
    title: "Employees",
    description: "Team members, roles, and schedules.",
    href: teamUrl("/manage#staff"),
    actionLabel: "Coming soon",
    disabled: true,
  },
  {
    id: "tags",
    title: "Tags",
    description: "Client tags for segmentation and marketing.",
    href: teamUrl("/manage#tags"),
    actionLabel: "Coming soon",
    disabled: true,
  },
  {
    id: "business",
    title: "Business Details",
    description: "Salon name, locations, and contact information.",
    href: teamUrl("/manage#business"),
    actionLabel: "Coming soon",
    disabled: true,
  },
];
