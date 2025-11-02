# Use Node.js 18 LTS as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the TypeScript code
RUN npm run build

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S strava -u 1001

# Create directory for exports (if needed)
RUN mkdir -p /app/exports && \
    chown -R strava:nodejs /app

# Switch to non-root user
USER strava



ARG STRAVA_CLIENT_ID
ARG STRAVA_CLIENT_SECRET
ARG STRAVA_ACCESS_TOKEN
ARG STRAVA_REFRESH_TOKEN
ARG ROUTE_EXPORT_PATH


# Strava API Configuration
ENV STRAVA_CLIENT_ID=$STRAVA_CLIENT_ID
ENV STRAVA_CLIENT_SECRET=$STRAVA_CLIENT_SECRET
ENV STRAVA_ACCESS_TOKEN=$STRAVA_ACCESS_TOKEN
ENV STRAVA_REFRESH_TOKEN=$STRAVA_REFRESH_TOKEN

# Set environment variables
ENV NODE_ENV=production
ENV TRANSPORT_TYPE=http
ENV PORT=3000


# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
