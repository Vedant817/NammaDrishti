# Multi-stage Dockerfile for NammaPulse
# Stage 1: Build the React PWA frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production runtime with Express API & WebSocket backend
FROM node:18-alpine
WORKDIR /app

# Install backend dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy server code
WORKDIR /app
COPY server ./server

# Copy compiled frontend build to static directory
COPY --from=frontend-builder /app/build ./public

ENV PORT=5001
ENV NODE_ENV=production

EXPOSE 5001

CMD ["node", "server/index.js"]
