import { teamUrl } from "./supabase-server";

export type ManageSection =
  | "hub"
  | "services"
  | "products"
  | "booking-policy"
  | "staff"
  | "tags"
  | "business"
  | "activity";

export type ManageNavItem = {
  id: ManageSection;
  label: string;
  href: string;
  disabled?: boolean;
};

export const MANAGE_NAV: ManageNavItem[] = [
  { id: "services", label: "Services", href: teamUrl("/services") },
  { id: "products", label: "Products", href: teamUrl("/inventory") },
  { id: "staff", label: "Employees", href: teamUrl("/manage/employees") },
  { id: "booking-policy", label: "Booking Policy", href: teamUrl("/booking-policy") },
  { id: "tags", label: "Tags", href: teamUrl("/clients") },
  { id: "business", label: "Business Details", href: teamUrl("/manage/business") },
  { id: "activity", label: "Activity Log", href: teamUrl("/manage/audit") },
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
    id: "staff",
    title: "Employees",
    description: "Team members, roles, and schedules.",
    href: teamUrl("/manage/employees"),
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
    id: "tags",
    title: "Tags",
    description: "Client tags for segmentation and marketing.",
    href: teamUrl("/clients"),
    actionLabel: "Open",
  },
  {
    id: "business",
    title: "Business Details",
    description: "Salon name, locations, and contact information.",
    href: teamUrl("/manage/business"),
    actionLabel: "Configure",
  },
  {
    id: "activity",
    title: "Activity Log",
    description: "Employee, role, and access changes recorded for review.",
    href: teamUrl("/manage/audit"),
    actionLabel: "Open",
  },
];
