/** Join a path onto Astro's BASE_URL (handles missing trailing slash on base). */
export function withBase(path = ""): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const segment = path.replace(/^\//, "");
  return segment ? `${base}/${segment}` : `${base}/`;
}
