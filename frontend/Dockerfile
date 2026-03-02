# Multi-stage build for React + Vite frontend

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time API URL (set in Dokploy Environment → Build Args)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production server with Nginx
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add custom log format at http level
RUN echo 'log_format detailed '\''$remote_addr:$remote_port -> $server_addr:$server_port [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"'\'';' > /etc/nginx/conf.d/00-log-format.conf

# Expose port 80
EXPOSE 80

# Start nginx with IP/port startup log
CMD sh -c 'IP=$(hostname -i 2>/dev/null || echo "0.0.0.0"); \
    echo "=========================================="; \
    echo " Frontend running at http://${IP}:80"; \
    echo "=========================================="; \
    nginx -g "daemon off;"'
