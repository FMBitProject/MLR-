# MLR Flow — production image
# Build:  docker compose up --build   (from the repo root)
# Postgres runs as a separate compose service; uploaded files are stored
# inline in Postgres (default storage driver), so no upload volume is needed.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` imports every route module to analyze it — our db client
# throws if DATABASE_URL is unset and our auth module throws if AUTH_SECRET
# is unset in production, so the build needs *some* value even though no
# route actually connects to the DB at build time (every route here is
# dynamic). These are never used at runtime — docker-compose's `environment:`
# supplies the real values to the running container.
ARG DATABASE_URL=postgres://build:build@localhost:5432/build
ARG AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV DATABASE_URL=${DATABASE_URL} \
    AUTH_SECRET=${AUTH_SECRET} \
    NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd -r mlr && useradd -r -g mlr mlr && mkdir -p /app/.data && chown -R mlr:mlr /app
COPY --from=build --chown=mlr:mlr /app/.next/standalone ./
COPY --from=build --chown=mlr:mlr /app/.next/static ./.next/static
COPY --from=build --chown=mlr:mlr /app/public ./public
USER mlr
EXPOSE 3000
VOLUME ["/app/.data"]
CMD ["node", "server.js"]
