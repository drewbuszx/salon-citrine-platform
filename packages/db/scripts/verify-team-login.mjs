/**
 * Verify team app login route (form POST to /team/api/auth/login).
 * Usage: node packages/db/scripts/verify-team-login.mjs <email> <password> [baseUrl]
 */
const email = process.argv[2]?.trim();
const password = process.argv[3] ?? "";
const baseUrl = (process.argv[4] ?? "http://localhost:4322/team").replace(/\/$/, "");

if (!email || !password) {
  console.error("Usage: node verify-team-login.mjs <email> <password> [baseUrl]");
  process.exit(1);
}

const body = new URLSearchParams({ email, password });
const response = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
  redirect: "manual",
});

console.log("Status:", response.status);
console.log("Location:", response.headers.get("location") ?? "(none)");
const setCookie = response.headers.getSetCookie?.() ?? [];
console.log("Set-Cookie count:", setCookie.length);
