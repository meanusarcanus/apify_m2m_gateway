FROM node:20-slim

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Compile TypeScript
RUN npm run build

# Default environment variables
ENV PORT=3000
EXPOSE 3000

# Start production server
CMD ["sh", "-c", "node dist/src/server.js"]
