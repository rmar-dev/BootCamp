# NestJS production image.
#
# Two stages: builder compiles TypeScript + generates the Prisma client;
# runtime keeps only what's needed to serve the dist + run `prisma migrate
# deploy` on startup.
#
# `docker` CLI is included because the platform's DockerRunner shells out
# to `docker exec` against the runner containers (which are siblings on the
# host docker daemon, mounted via /var/run/docker.sock).

FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps. openssl is needed by Prisma engines on alpine.
RUN apk add --no-cache openssl

COPY platform/package*.json ./
COPY platform/prisma ./prisma
RUN npm ci

COPY platform/ ./
RUN npx prisma generate
RUN npm run build


FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# docker-cli lets the platform process spawn execs against the sibling
# runner containers via the mounted /var/run/docker.sock.
RUN apk add --no-cache openssl docker-cli

COPY platform/package*.json ./
COPY platform/prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Migrations run on container startup so a fresh DB self-bootstraps. If you
# add a step that should run only once (seed), wrap it with `--profile init`
# in compose so it doesn't repeat on every restart.
COPY deploy/platform-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3002
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
