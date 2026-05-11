/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle in `.next/standalone`. The
  // production Docker image (deploy/web.Dockerfile) copies this directly
  // and runs `node server.js` — no need to ship node_modules at runtime.
  // Has no effect on `next dev`.
  output: 'standalone',
};

export default nextConfig;
