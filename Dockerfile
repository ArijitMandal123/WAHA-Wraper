FROM devlikeapro/waha:latest

USER root

# Install Node.js and npm if not present
RUN apt-get update && apt-get install -y nodejs npm

# Create separate directory for sync app
RUN mkdir -p /app/sync
WORKDIR /app/sync

# Copy and install sync dependencies separately
COPY package.json /app/sync/
RUN npm install

# Copy sync scripts
COPY sync.js /app/sync/
COPY start.sh /app/

# Set working directory back to /app
WORKDIR /app

# Make start.sh executable
RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 3001

# Set CMD
CMD ["./start.sh"]