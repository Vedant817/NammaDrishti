# Multi-stage Dockerfile for NammaDrishti
# Stage 1: Build the React PWA frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
ARG REACT_APP_FIREBASE_PROJECT_ID
ARG REACT_APP_FIREBASE_API_KEY
ARG REACT_APP_FIREBASE_AUTH_DOMAIN
ARG REACT_APP_FIREBASE_APP_ID
COPY . .
RUN npm run build

# Stage 2: Production runtime with Express API & WebSocket backend
FROM node:24-alpine
WORKDIR /app

# Install backend dependencies (production only)
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev

# Copy server code
WORKDIR /app
COPY server ./server

# Copy compiled frontend build to static directory
COPY --from=frontend-builder /app/build ./public

ENV PORT=5001
ENV NODE_ENV=production

EXPOSE 5001

CMD ["node", "server/index.js"]
