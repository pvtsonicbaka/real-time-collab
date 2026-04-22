# ── Stage 1: deps ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ── Stage 3: production runner ───────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist

USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "dist/index.js"]
