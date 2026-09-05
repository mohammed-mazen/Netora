# Netora — production container image (VPS deployment)
# Multi-stage build: compile TypeScript + Vite assets, then ship a minimal
# runtime image. Requires an external MySQL/MariaDB (DATABASE_URL) and
# S3-compatible storage — this container is stateless.
FROM node:20-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts   # ← تم التعديل هنا
COPY . .
RUN pnpm run build

FROM node:20-slim AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts   # ← تم التعديل هنا
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3000
CMD ["node", "dist/index.js"]
