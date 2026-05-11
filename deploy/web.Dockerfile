# Next.js production image using the `standalone` output format.
#
# The standalone build packages every transitive dependency the server needs
# at runtime, so the runner stage doesn't need `npm ci` at all — it copies
# the pre-resolved tree from the builder. Final image ~150 MB.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY web/package*.json ./
RUN npm ci


FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./

# Same-origin requests via Caddy — the web client uses relative URLs and
# Next.js does the rest. `NEXT_PUBLIC_*` is baked at build time so this
# empty string locks the API base to the current origin in the bundled JS.
ENV NEXT_PUBLIC_API_BASE=""
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user — Next.js standalone doesn't need anything more privileged.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone output: server.js + minimal node_modules. Static assets and
# /public are copied separately because they live outside the standalone bundle.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
