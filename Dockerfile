FROM devlikeapro/waha:latest

USER root

# Install Node.js and npm if not present
RUN apt-get update && apt-get install -y nodejs npm

# Create separate directory for sync app
RUN mkdir -p /app/sync
WORKDIR /app/sync

# Copy and install sync dependencies separately
COPY package.json /app/sync/
RUN npm install --production

# Copy sync scripts
COPY sync.js /app/sync/
COPY start.sh /app/

# Set working directory back to /app
WORKDIR /app

# Make start.sh executable
RUN chmod +x /app/start.sh

# Create necessary directories
RUN mkdir -p /app/.sessions /app/.media

# Expose ports
EXPOSE 3000 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Set CMD
CMD ["./start.sh"]
