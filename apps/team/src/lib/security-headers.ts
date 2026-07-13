export function createCspNonce(): string {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))),
  );
}

export function buildContentSecurityPolicy(nonce: string): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}
