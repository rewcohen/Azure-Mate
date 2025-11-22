# Multi-stage build for Azure Architect Mate

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
# These are baked into the build at compile time (required for Vite)
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_TENANT_ID=organizations
ARG VITE_AZURE_REDIRECT_URI

# Set environment variables for build
ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_AZURE_REDIRECT_URI=$VITE_AZURE_REDIRECT_URI

# Copy package files
COPY package*.json ./

# Install dependencies (using npm install to generate package-lock.json if missing)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production - serve with nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
