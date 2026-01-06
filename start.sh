#!/bin/bash

# Download sessions from MongoDB
node sync.js --download

# Start the watcher in background
node sync.js --watch &

# Start WAHA
exec node dist/main.js