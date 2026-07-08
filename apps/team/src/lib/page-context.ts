/**
 * Contextual page titles and subtitles for the team app shell.
 * Nav labels in TeamSiteHeader stay concise; these are descriptive headings.
 */
export const PAGE_CONTEXT = {
  dashboard: {
    nav: "Dashboard",
    title: "Team Dashboard",
    subtitle: "Your tasks, salon routines, and upcoming team events.",
  },
  book: {
    nav: "Book",
    title: "Appointment Book",
    subtitle: "Manage appointments, availability, blocks, and waitlist activity.",
  },
  tasks: {
    nav: "Tasks",
    title: "Team Tasks & Checklists",
    subtitle: "Assign work, claim open tasks, and track salon checklists.",
    primaryAction: "Create task",
  },
  stock: {
    nav: "Stock",
    title: "Inventory Tracker",
    subtitle: "Monitor salon products, stock levels, and reorder needs.",
    primaryAction: "Add product",
  },
  clients: {
    nav: "Clients",
    title: "Client Directory",
    subtitle: "Search client profiles, appointment history, preferences, and contact details.",
    primaryAction: "Add client",
  },
  docs: {
    nav: "Docs",
    title: "Documents & Resources",
    subtitle: "Store policies, training materials, forms, and salon references.",
    primaryAction: "Upload document",
  },
  events: {
    nav: "Events",
    title: "Team Calendar & Events",
    subtitle: "Track birthdays, time off, closures, meetings, and salon announcements.",
    primaryAction: "Add event",
  },
  reports: {
    nav: "Reports",
    title: "Business Reports & Insights",
    subtitle: "Review appointments, revenue, client activity, and inventory trends.",
  },
  manage: {
    nav: "Manage",
    title: "Business Settings",
    subtitle: "Manage employees and salon business details.",
  },
} as const;

export type PageContextKey = keyof typeof PAGE_CONTEXT;
