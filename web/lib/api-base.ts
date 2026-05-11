/**
 * Resolve the base URL for API calls — client and server side need different
 * answers in a containerized deploy:
 *
 *   - Client (browser):  hits the public Caddy edge same-origin → "" (relative)
 *   - Server (SSR):       hits the in-cluster platform directly via docker DNS
 *                        (Caddy is at the edge, the web container is on the
 *                        internal network alongside the platform container)
 *
 * Without the split, server components in the production image try to fetch
 * relative URLs like `/api/auth/me`, which undici rejects with TypeError. The
 * surface symptom is every server-guarded page redirecting to /login because
 * the role-guard's fetch throws and the catch-redirects.
 *
 * Resolution order (each side falls through to the next):
 *
 *   Server:  INTERNAL_API_BASE → NEXT_PUBLIC_API_BASE (if absolute) → dev default
 *   Browser: NEXT_PUBLIC_API_BASE → ""  (same-origin)
 *
 * `NEXT_PUBLIC_*` is inlined at build time and shared between both bundles, so
 * we can't use it alone — INTERNAL_API_BASE is a runtime-only var read by the
 * standalone Node server.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') {
    // Server-side render: prefer the explicit internal URL.
    const internal = process.env.INTERNAL_API_BASE;
    if (internal && internal.length > 0) return internal;
    const pub = process.env.NEXT_PUBLIC_API_BASE;
    // NEXT_PUBLIC_API_BASE may have been baked as "" for same-origin client
    // use; that's not a valid absolute URL on the server.
    if (pub && /^https?:\/\//.test(pub)) return pub;
    return 'http://localhost:3002';
  }
  // Browser: empty string is fine — fetch('/api/x') resolves to current origin.
  return process.env.NEXT_PUBLIC_API_BASE ?? '';
}
