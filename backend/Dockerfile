# Backend Dockerfile for Production/Staging
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy Prisma schema
COPY backend/prisma ./backend/prisma

# Generate Prisma client
RUN cd backend && pnpm db:generate

# Copy source code
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/
COPY shared/src ./shared/src

# Build application
RUN cd backend && pnpm build

# Production stage
FROM node:18-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma files
COPY backend/prisma ./backend/prisma
COPY --from=base /app/backend/node_modules/.prisma ./backend/node_modules/.prisma

# Copy built application
COPY --from=base /app/backend/dist ./backend/dist
COPY --from=base /app/shared/dist ./shared/dist

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
