#!/bin/bash

# Download sessions from MongoDB
cd /app/sync && node sync.js --download

# Start the watcher in background
cd /app/sync && node sync.js --watch &

# Ensure we're in the correct directory for WAHA
cd /app

# Start WAHA
exec node dist/main.js