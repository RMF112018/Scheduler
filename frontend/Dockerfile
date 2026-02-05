# Frontend Dockerfile for Production/Staging
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY frontend ./frontend
COPY shared/src ./shared/src

# Build application
WORKDIR /app/frontend
RUN pnpm build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy built files
COPY --from=base /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
