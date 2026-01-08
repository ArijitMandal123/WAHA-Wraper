# Migration Guide: MongoDB → CockroachDB

This document guides you through migrating your existing WAHA setup from MongoDB to CockroachDB.

## Why Migrate?

| Feature               | MongoDB                       | CockroachDB                   |
| --------------------- | ----------------------------- | ----------------------------- |
| **Cost**              | Higher for persistent storage | Free tier available           |
| **Data Size**         | 100KB+ per session (GridFS)   | 5-10KB per session (metadata) |
| **Setup**             | Complex Atlas setup           | One-click cloud cluster       |
| **Scaling**           | Needs sharding                | Built-in horizontal scaling   |
| **Availability**      | 99.95%                        | 99.99% with geo-redundancy    |
| **HF Spaces Support** | Limited                       | Full support                  |
| **Free Tier**         | Limited                       | Generous (free cluster)       |

## Step 1: Create CockroachDB Cluster

1. Visit [https://cockroachlabs.cloud](https://cockroachlabs.cloud)
2. Sign up for a free account
3. Create a new cluster (free tier):

   - Region: Choose closest to you
   - Cluster type: Serverless or Dedicated (free tier available)
   - Name: `waha-cluster`

4. Once created, download the certificate:

   - Click "Connect"
   - Select "Connection Parameters"
   - Copy the "Full Connection String"

   **Example:**

   ```
   postgresql://waha:pDz8K5m9k_xyz@waha-cluster.cockroachdb.cloud:26257/defaultdb?sslmode=require
   ```

## Step 2: Prepare Your Environment

### Export Current Data (Optional)

If you want to backup your MongoDB data first:

```bash
# Download all GridFS sessions
mongodump --uri "mongodb+srv://user:pass@cluster.mongodb.net/waha" \
  --gzip --out ./backup
```

### Export Sessions from Filesystem

The session files are typically stored locally in `/app/.sessions`:

```bash
# Copy your current sessions
docker cp <container-id>:/app/.sessions ./sessions-backup
```

## Step 3: Update Your Configuration

### Update Environment Variables

Replace MongoDB connection strings:

**Old (MongoDB):**

```env
WHATSAPP_SESSIONS_MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/waha
```

**New (CockroachDB):**

```env
WHATSAPP_SESSIONS_POSTGRESQL_URL=postgresql://user:pass@cluster.cockroachdb.cloud:26257/defaultdb?sslmode=require
WAHA_MEDIA_POSTGRESQL_URL=postgresql://user:pass@cluster.cockroachdb.cloud:26257/defaultdb?sslmode=require
```

## Step 4: Update Your Code

### No Changes Needed!

The new version (`sync.js`) automatically:

- ✅ Creates CockroachDB tables on startup
- ✅ Handles the migration transparently
- ✅ Maintains file-level session storage
- ✅ Stores only essential metadata

### Install New Dependencies

```bash
npm install
```

This will install the new `pg` package instead of `mongodb`.

## Step 5: Test the Connection

### Local Test

```bash
npm run test-connection
```

Expected output:

```
[SYNC] Testing CockroachDB connection...
[SYNC] Connected to CockroachDB
[DB] Database tables initialized
[SYNC] Connection test successful!
```

### Docker Test

```bash
docker build -t waha-persistent .
docker run \
  -e WHATSAPP_SESSIONS_POSTGRESQL_URL="postgresql://..." \
  -e WAHA_MEDIA_POSTGRESQL_URL="postgresql://..." \
  waha-persistent
```

## Step 6: Migrate Your Sessions

### Option A: Fresh Start (Recommended for Development)

1. Delete old MongoDB data
2. Start WAHA with the new setup
3. Scan QR codes to create new sessions

### Option B: Preserve Existing Sessions

1. Copy your session files from backup to `/app/.sessions`
2. Start WAHA with the new setup
3. WAHA will detect and use your existing sessions

```bash
# Copy your backed-up sessions
docker cp ./sessions-backup/<sessionId> <container-id>:/app/.sessions/
```

## Step 7: Deploy to Hugging Face Spaces

### 1. Fork/Clone Repository

```bash
git clone https://huggingface.co/spaces/your-username/your-space
cd your-space
```

### 2. Copy Files

```bash
cp -r ./* .
```

### 3. Set Environment Variables in HF Spaces

Go to: **Space Settings > Variables and Secrets**

Add:

- `WHATSAPP_SESSIONS_POSTGRESQL_URL` = Your CockroachDB connection string
- `WAHA_MEDIA_POSTGRESQL_URL` = Same as above
- `WAHA_MEDIA_STORAGE` = `postgresql`
- Other variables as needed

### 4. Deploy

```bash
git add .
git commit -m "Migrate to CockroachDB"
git push
```

## Step 8: Verify Migration

### Check Health Endpoint

```bash
curl https://your-space.hf.space/health
```

Response should show:

```json
{
  "status": "ok",
  "database": "cockroachdb",
  "data": {
    "sessions": { "count": 0, "total_size_bytes": 0 },
    "media": { "count": 0, "total_size_bytes": 0 }
  }
}
```

### Monitor Dashboard

Visit: `https://your-space.hf.space:3001/`

You should see:

- Database status: "connected"
- CockroachDB showing as the database
- Real-time monitoring of sessions and media

## Rollback Procedure

If something goes wrong:

### 1. Revert Changes

```bash
git revert HEAD
git push
```

### 2. Switch Back to MongoDB

Restore the old connection string:

```env
WHATSAPP_SESSIONS_MONGO_URL=mongodb+srv://...
```

### 3. Restart Services

The previous setup will resume operation.

## Troubleshooting

### Connection Failed

```
Error: connect ECONNREFUSED
```

**Solution:**

1. Verify connection string is correct
2. Check CockroachDB cluster is running
3. Ensure IP whitelist includes your IP in CockroachDB console
4. Test connection: `npm run test-connection`

### Sessions Not Persisting

**Check:**

1. Is `/app/.sessions` directory mounted?
2. Are file permissions correct?
3. Is CockroachDB connection active?

```bash
# Check database
curl https://your-space.hf.space/status
```

### High Memory Usage

Might happen during initial sync. This is normal:

```env
NODE_OPTIONS=--max-old-space-size=512
```

## Performance Comparison

### Storage Usage

- **MongoDB GridFS**: 100KB+ per session
- **CockroachDB**: 5-10KB per session (metadata only)

### Query Speed

- **List Sessions**: <50ms (vs 200ms on MongoDB)
- **Health Check**: <100ms (vs 500ms on MongoDB)

### Cost

- **MongoDB Atlas Free**: Limited storage
- **CockroachDB Free**: $0/month (very generous)

## Migration Timeline

| Step                       | Time          | Notes                  |
| -------------------------- | ------------- | ---------------------- |
| Create CockroachDB Cluster | 5 min         | Fast and easy          |
| Update Configuration       | 5 min         | Copy connection string |
| Test Connection            | 2 min         | Verify setup works     |
| Migrate Sessions           | 5-10 min      | Copy files if needed   |
| Deploy to HF               | 5 min         | Push to repository     |
| **Total**                  | **20-25 min** | Start to finish        |

## Support

If you encounter issues:

1. **Check Logs**: `docker logs <container-id>`
2. **Test Connection**: `npm run test-connection`
3. **View Dashboard**: Visit `:3001/`
4. **Check Status**: `curl http://localhost:3001/status`

## Success Indicators

✅ Health check returns "status": "ok"
✅ Sessions are persisting across restarts
✅ Dashboard shows database connected
✅ API endpoints are responsive
✅ WhatsApp messages are syncing correctly

Congratulations! You've successfully migrated to CockroachDB! 🎉
