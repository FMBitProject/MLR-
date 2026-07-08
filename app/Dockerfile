# MLR Flow — production image
# Build:  docker compose up --build   (from the repo root)
# Data (SQLite DB + uploaded files) persists in the volume mounted at /app/.data

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Non-root user; .data must stay writable for SQLite + uploads
RUN groupadd -r mlr && useradd -r -g mlr mlr && mkdir -p /app/.data && chown -R mlr:mlr /app
COPY --from=build --chown=mlr:mlr /app/.next/standalone ./
COPY --from=build --chown=mlr:mlr /app/.next/static ./.next/static
COPY --from=build --chown=mlr:mlr /app/public ./public
USER mlr
EXPOSE 3000
VOLUME ["/app/.data"]
CMD ["node", "server.js"]
