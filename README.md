# WAHA with Persistent Sessions on Hugging Face Spaces

This project provides a Dockerized version of WAHA Core (WhatsApp HTTP API) with persistent session storage using CockroachDB. This prevents WhatsApp logouts on infrastructure restarts.

## What Changed (MongoDB → CockroachDB)

✅ **Removed MongoDB** - No more GridFS overhead  
✅ **Added CockroachDB (PostgreSQL)** - Lightweight, optimized schema  
✅ **Optimized Data Storage** - Store only essential metadata, not full files  
✅ **Health Check Endpoint** - `/health` with database status and data info  
✅ **Better Monitoring** - Real-time dashboard showing stored data  
✅ **Hugging Face Ready** - Full support for Spaces deployment

## Features

- **Persistent Sessions**: Sessions survive application restarts
- **Optimized Storage**: Only essential metadata stored in database (< 1MB total for metadata)
- **Health Monitoring**: Built-in health check endpoints for monitoring
- **Real-time Dashboard**: View stored sessions and database statistics
- **Hugging Face Compatible**: Easy deployment on HF Spaces
- **File Watching**: Automatic sync of session files

## Files Overview

- `Dockerfile`: Builds the custom WAHA image with CockroachDB sync
- `sync.js`: Node.js script for syncing sessions with CockroachDB (optimized)
- `start.sh`: Shell script to coordinate sync and WAHA startup
- `package.json`: Dependencies (now uses `pg` instead of `mongodb`)
- `.env.example`: Environment variable template
- `render.yaml`: Deployment configuration for Render

## Architecture

```
WhatsApp Client → WAHA API (Port 3000)
                    ↓
            Session Manager
                    ↓
         File Watcher (chokidar)
                    ↓
    CockroachDB (Metadata Only) + Local Filesystem
```

## Deployment on Hugging Face Spaces

### Step 1: Get CockroachDB Connection String

1. Visit [https://cockroachlabs.cloud](https://cockroachlabs.cloud)
2. Create a free cluster
3. Get your connection string:
   ```
   postgresql://user:password@your-cluster.cockroachdb.cloud:26257/defaultdb?sslmode=require
   ```

### Step 2: Create Hugging Face Space

1. Go to [https://huggingface.co/spaces](https://huggingface.co/spaces)
2. Click "Create new Space"
3. Choose "Docker" as the space type
4. Set **Persistent Storage**: Enable (needed for session files)
   - Mount path: `/data`

### Step 3: Add Environment Variables

In your HF Space Settings > Variables and Secrets, add:

| Secret Name                        | Value                              | Example                                                                     |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| `WHATSAPP_SESSIONS_POSTGRESQL_URL` | Your CockroachDB connection string | `postgresql://user:pass@cluster.cockroachdb.cloud:26257/db?sslmode=require` |
| `WAHA_MEDIA_POSTGRESQL_URL`        | Same CockroachDB connection string | `postgresql://user:pass@cluster.cockroachdb.cloud:26257/db?sslmode=require` |
| `WAHA_MEDIA_STORAGE`               | `postgresql`                       | `postgresql`                                                                |
| `WHATSAPP_HOOK_URL`                | Your webhook URL (optional)        | `https://your-instance.hf.space/webhook/whatsapp`                           |
| `WAHA_API_KEY`                     | Your API key                       | `your-secure-key-2026`                                                      |
| `WHATSAPP_DEFAULT_ENGINE`          | `GOWS`                             | `GOWS`                                                                      |
| `WAHA_DASHBOARD_USERNAME`          | `admin`                            | `admin`                                                                     |
| `WAHA_DASHBOARD_PASSWORD`          | Your password                      | `secure-password`                                                           |

### Step 4: Deploy

1. Push the repository to Hugging Face

   ```bash
   git clone https://huggingface.co/spaces/your-username/your-space
   cd your-space
   git add .
   git commit -m "Initial commit with CockroachDB support"
   git push
   ```

2. HF Spaces will automatically build and deploy your Docker image

## Health Check Endpoints

### 1. Health Check (WAHA Plus Compatible)

```bash
curl https://your-space.hf.space/health
```

**Response (Success):**

```json
{
  "status": "ok",
  "database": "cockroachdb",
  "component": "waha-sync",
  "timestamp": "2026-01-09T10:30:00.000Z",
  "data": {
    "sessions": {
      "count": 5,
      "total_size_bytes": 245000,
      "last_updated": "2026-01-09T10:25:00Z"
    },
    "media": {
      "count": 12,
      "total_size_bytes": 1500000
    }
  }
}
```

**Response (Error):**

```json
{
  "status": "error",
  "database": "cockroachdb",
  "component": "waha-sync",
  "error": "connection refused",
  "timestamp": "2026-01-09T10:30:00.000Z"
}
```

### 2. Status Endpoint (Detailed Dashboard)

```bash
curl https://your-space.hf.space/status
```

Shows detailed information about stored sessions and local files.

### 3. HTML Dashboard

Visit `https://your-space.hf.space:3001/` for a real-time monitoring dashboard.

## Data Storage Optimization

### What's Stored (Minimal):

- ✅ Session filename
- ✅ File hash (SHA-256)
- ✅ File size in bytes
- ✅ Upload/update timestamps

### What's NOT Stored (Reducing space):

- ❌ Full session file content (kept locally)
- ❌ Unused metadata fields
- ❌ Redundant information
- ❌ Binary blobs (MongoDB GridFS style)

**Result**: ~5-10KB per session in metadata (vs 100KB+ with MongoDB GridFS)

## Build Instructions

1. Ensure you have Docker installed
2. Build the image:
   ```bash
   docker build -t waha-persistent .
   ```

## Local Deployment (Development)

### Prerequisites

- Docker
- Node.js 18+
- CockroachDB account (free tier available)

### Setup

1. Clone the repository:

   ```bash
   git clone <your-repo>
   cd waha-sync
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` file:

   ```bash
   cp .env.example .env
   # Edit .env with your CockroachDB connection string
   ```

4. Test connection:

   ```bash
   npm run test-connection
   ```

5. Start with Docker:
   ```bash
   docker build -t waha-persistent .
   docker run -p 3000:3000 -p 3001:3001 \
     -e WHATSAPP_SESSIONS_POSTGRESQL_URL="postgresql://..." \
     -e WAHA_MEDIA_POSTGRESQL_URL="postgresql://..." \
     waha-persistent
   ```

## Available Commands

```bash
# Start the watch mode (default)
npm start

# Test database connection
npm run test-connection

# Download sessions from database
npm run download
```

## Troubleshooting

### "Error: connect ECONNREFUSED"

- Verify CockroachDB connection string in environment variables
- Check IP whitelist in CockroachDB console
- Ensure credentials are correct

### "Health check returns 500"

- Check database connection string
- Verify CockroachDB cluster is running
- Check logs: `docker logs <container-id>`

### Sessions not persisting

1. Verify `/app/.sessions` directory exists
2. Check file permissions
3. Ensure CockroachDB is connected
4. Check dashboard at `:3001/`

## API Usage

### Start WhatsApp Session

```bash
curl -X POST http://localhost:3000/sessions/start \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "default"}'
```

### Check Session Status

```bash
curl http://localhost:3000/sessions/default/me \
  -H "X-API-Key: your-api-key"
```

### Get All Sessions

```bash
curl http://localhost:3000/sessions \
  -H "X-API-Key: your-api-key"
```

## Deployment on Render (Alternative)

If deploying on Render instead of HF Spaces:

1. Create a Web Service on Render
2. Set the same environment variables
3. Use `render.yaml` for configuration
4. Set Docker command to: `./start.sh`

## Database Schema

### Sessions Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  filename VARCHAR(255) UNIQUE,
  size_bytes BIGINT,
  file_hash VARCHAR(64),
  uploaded_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Media Files Table (Optional)

```sql
CREATE TABLE media_files (
  id UUID PRIMARY KEY,
  filename VARCHAR(255) UNIQUE,
  size_bytes BIGINT,
  mime_type VARCHAR(100),
  file_hash VARCHAR(64),
  uploaded_at TIMESTAMP
);
```

## Security Recommendations

1. **Rotate API Keys**: Change `WAHA_API_KEY` regularly
2. **Strong Passwords**: Use strong `WAHA_DASHBOARD_PASSWORD`
3. **HTTPS Only**: Always use HTTPS in production
4. **IP Whitelist**: Restrict CockroachDB access in production
5. **Rate Limiting**: Implement rate limiting for API endpoints
6. **Webhook Validation**: Verify webhook signatures from n8n

## Performance Notes

- **Metadata overhead**: ~5-10KB per session
- **Max sessions**: Unlimited (CockroachDB scales horizontally)
- **File watch latency**: 2-3 seconds (configurable)
- **Health check latency**: <100ms (local DB queries)

## Support & Issues

For issues:

1. Check the dashboard at `:3001/`
2. Review logs with `docker logs <container>`
3. Test connection with `npm run test-connection`
4. Verify environment variables

## License

MIT

## Version History

### v2.0.0 (Current)

- ✅ Migrated from MongoDB to CockroachDB
- ✅ Optimized data storage
- ✅ Added health check endpoints
- ✅ Hugging Face Spaces support
- ✅ Real-time monitoring dashboard
- ✅ Improved documentation

### v1.0.0

- Initial release with MongoDB support

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

## Accessing WAHA

### Web Dashboard

- **URL:** `https://your-service.onrender.com/dashboard`
- **Username:** `admin` (or check `WAHA_DASHBOARD_USERNAME` env var)
- **Password:** Check Render environment variables or logs for `WAHA_DASHBOARD_PASSWORD`

### API Authentication

### API Authentication

- **API Key:** Auto-generated by WAHA on startup - check the deployment logs for:
  ```
  WAHA_API_KEY: your-generated-api-key
  ```
- **Usage:** Include in headers: `X-API-Key: your-api-key`

### Status Page

- **URL:** `https://your-service.onrender.com:3001/`
- Shows MongoDB connection status and session sync information

## Troubleshooting

### MongoDB Authentication Failed

**Error:** `bad auth : authentication failed`

**Solutions:**

1. **Check your connection string format:**

   - Should be: `mongodb+srv://username:password@cluster.mongodb.net/database`
   - Replace `username`, `password`, `cluster`, and `database` with your actual values
   - Make sure there are no extra spaces or characters

2. **Verify credentials:**

   - Go to MongoDB Atlas → Database Access
   - Ensure your user has read/write permissions
   - Check if the password is correct (reset if needed)

3. **Database name:**

   - The database name in the URL should match your actual database
   - Default is often `test` or `admin` - create a specific database if needed

4. **Network access:**

   - In Atlas → Network Access, ensure your IP is whitelisted or set to 0.0.0.0/0 for testing

5. **Test locally:**
   ```bash
   export WHATSAPP_SESSIONS_MONGO_URL="your-connection-string"
   node sync.js --test-connection
   ```

### WAHA Startup Issues

**Error:** `No such file or directory` for entrypoint.sh

**Solution:** The startup script has been updated to use `npm start` instead of the entrypoint.sh file. If you still get errors, check the Render logs for the correct startup command.

### Memory Issues

**Error:** Out of memory or high memory usage

**Solution:** The `NODE_OPTIONS=--max-old-space-size=400` limits Node.js to 400MB. If you need more memory, consider upgrading to Render's paid plans.

### Session Sync Not Working

**Check:**

1. MongoDB connection is successful (no auth errors)
2. Status page shows files being uploaded/downloaded
3. WhatsApp sessions are actually created and used

### Status Page Not Loading

**URL:** `https://your-app.onrender.com:3001/`

**If not working:**

1. Check Render logs for status server startup: `[SYNC] Status server running on port 3001`
2. Ensure port 3001 is configured in render.yaml
3. Try accessing `https://your-app.onrender.com:3001/status` for JSON data

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
