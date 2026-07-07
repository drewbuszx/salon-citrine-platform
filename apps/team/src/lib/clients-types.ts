export type ClientSortKey =
  | "name"
  | "recently_added"
  | "last_visit"
  | "next_appointment"
  | "visits"
  | "ltv";

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  preferredName: string | null;
  phone: string | null;
  email: string | null;
  phoneDisplay: string | null;
  emailDisplay: string | null;
  tags: string[];
  tagLabels: string[];
  visitCount: number;
  ltvCents: number;
  ltvLabel: string;
  ltvTitle: string;
  ltvKind: "value" | "zero" | "none";
  lastVisitLabel: string | null;
  providerName: string | null;
  upcomingLabel: string | null;
  upcomingAt: string | null;
  initials: string;
};

export type ClientDirectorySummary = {
  total: number;
  newThisMonth: number;
  withUpcoming: number;
  withoutUpcoming: number;
};

export type ClientSearchResponse = {
  clients: ClientListItem[];
  total: number;
  query: string;
  filtersApplied: number;
  sort: ClientSortKey;
  page: number;
  perPage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  summary: ClientDirectorySummary;
};

export type PossibleDuplicate = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};
