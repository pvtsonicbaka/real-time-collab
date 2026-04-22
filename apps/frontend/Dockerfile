# ── Stage 1: deps ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# VITE_API_URL injected at build time: docker build --build-arg VITE_API_URL=https://api.yourdomain.com
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm run build

# ── Stage 3: serve with nginx ───────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
# health probe file for k8s/docker healthcheck
RUN echo "ok" > /usr/share/nginx/html/health.txt
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
