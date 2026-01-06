# WAHA with Persistent Sessions on Render

This project provides a Dockerized version of WAHA Core (WhatsApp HTTP API) with persistent session storage using MongoDB Atlas. This prevents WhatsApp logouts on Render's free tier restarts.

## Files Overview

- `Dockerfile`: Builds the custom WAHA image with sync capabilities
- `sync.js`: Node.js script for syncing session files with MongoDB GridFS
- `start.sh`: Shell script to coordinate sync and WAHA startup
- `package.json`: Dependencies for the sync script
- `render.yaml`: Render deployment configuration (optional)

## Build Instructions

1. Ensure you have Docker installed
2. Build the image:
   ```bash
   docker build -t waha-persistent .
   ```

## Deployment on Render

### Option 1: Manual Setup

1. Create a new Web Service on Render
2. Connect your GitHub repository (or upload files)
3. Set the following environment variables:
   - `WHATSAPP_SESSIONS_MONGO_URL`: Your MongoDB Atlas connection string
   - `WHATSAPP_DEFAULT_ENGINE`: `GOWS`
   - `PORT`: `3000`
   - `WHATSAPP_API_KEY_EXCLUDE_PATH`: `ping,health`
   - `NODE_OPTIONS`: `--max-old-space-size=400` (Prevents memory issues on free tier)
4. Set the Docker command to: `./start.sh`
5. Deploy

### Option 2: Using render.yaml

1. Push the code to GitHub with the `render.yaml` file
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` and configure the service
5. Only set the `WHATSAPP_SESSIONS_MONGO_URL` environment variable (others are in render.yaml)
6. Deploy

## MongoDB Setup

1. Create a MongoDB Atlas cluster
2. Create a database user with read/write permissions
3. Get the connection string and set it as `WHATSAPP_SESSIONS_MONGO_URL`

## Performance Optimizations

### Memory Management

The `NODE_OPTIONS=--max-old-space-size=400` setting limits Node.js memory usage to 400MB, which is crucial for Render's free tier that provides only 512MB RAM total. This prevents:

- Memory exhaustion causing app restarts
- Performance degradation from garbage collection
- Service unavailability due to OOM (Out of Memory) errors

**Why 400MB?** This leaves ~100MB for the WAHA core application and system processes, ensuring stable operation within the free tier limits.

### Engine Selection

Using `WHATSAPP_DEFAULT_ENGINE=GOWS` instead of the default engine reduces memory footprint while maintaining full WhatsApp functionality.

## How It Works

- On startup, the container downloads existing session files from MongoDB to `/app/.sessions`
- A background watcher monitors the sessions folder and uploads changes to MongoDB
- WAHA runs with persistent sessions across restarts

## Testing MongoDB Connection

Before deploying, test your MongoDB connection:

```bash
# Set your MongoDB URL
export WHATSAPP_SESSIONS_MONGO_URL="your-mongodb-connection-string"

# Test connection and list stored sessions
node sync.js --test-connection
```

This will:

- Verify the connection to MongoDB Atlas
- Show the database name
- List all session files currently stored in GridFS
- Display file sizes and upload dates

## Status Monitoring Page

The sync script includes a built-in status monitoring page that shows:

- MongoDB connection status
- Number of stored session files
- Local session files
- Real-time sync activity

### Access the Status Page

After deployment, visit: `https://your-render-app.onrender.com:3001/`

Or in local development:

```bash
# Start the watcher with status server
node sync.js --watch
# Then visit http://localhost:3001
```

### API Endpoint

You can also access JSON data at: `https://your-render-app.onrender.com:3001/status`

### Features

- **Auto-refresh**: Updates every 5 seconds
- **Manual refresh**: Click "Refresh Now" button
- **Connection status**: Shows if MongoDB is reachable
- **File listings**: Displays both stored and local session files
- **Error handling**: Shows connection errors clearly

## Monitoring Data Sharing

### In Render Logs

Monitor your Render service logs for sync activity:

- `[SYNC] Starting download phase...`
- `[SYNC] Downloading session.key...`
- `[SYNC] Starting watch mode...`
- `[SYNC] Uploading session.key...`

### In MongoDB Atlas Dashboard

1. Go to your MongoDB Atlas cluster
2. Navigate to **Collections**
3. Look for the `sessions.files` and `sessions.chunks` collections
4. These contain your GridFS stored session files

### Manual Verification

You can also run the test command in your deployed Render service:

1. Go to Render dashboard → Your service → Shell
2. Run: `node sync.js --test-connection`
