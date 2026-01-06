FROM devlikeapro/waha:latest

USER root

# Install Node.js and npm
RUN apt-get update && apt-get install -y nodejs npm

# Copy package.json and install dependencies
COPY package.json /app/
RUN npm install

# Copy scripts
COPY sync.js /app/
COPY start.sh /app/
RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 3001

# Set CMD
CMD ["./start.sh"]