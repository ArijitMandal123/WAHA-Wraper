#!/bin/bash

# Download sessions from MongoDB
cd /app/sync && node sync.js --download

# Start the watcher in background
cd /app/sync && node sync.js --watch &

# Start WAHA
exec node dist/main.js