import { BUSINESS } from "@saloncitrine/shared";

/** Marketing site origin — used for cross-app nav links in dev and prod. */
export const MARKETING_ORIGIN = `https://${BUSINESS.domain}`;

export const SHOP_URL = "https://saloncitrineindy.myshopify.com/";
export const GIFT_CARDS_URL =
  "https://saloncitrineindy.glossgenius.com/shop/gift-cards";

/** Build a marketing-site URL (hash anchors, pages, etc.). */
export function marketingUrl(path = ""): string {
  if (!path || path === "/") return `${MARKETING_ORIGIN}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${MARKETING_ORIGIN}${normalized}`;
}
