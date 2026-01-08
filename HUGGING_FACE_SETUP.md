# Hugging Face Spaces Deployment Guide

Complete step-by-step guide to deploy WAHA with CockroachDB on Hugging Face Spaces.

## Prerequisites

- Hugging Face account (free)
- CockroachDB account (free tier available)
- Git installed locally

## Step 1: Create CockroachDB Cluster (Free)

### 1.1 Sign Up

1. Visit [https://cockroachlabs.cloud](https://cockroachlabs.cloud)
2. Click "Sign Up"
3. Create account with email

### 1.2 Create Cluster

1. Click "Create Cluster"
2. Select "Serverless" (free tier)
3. Choose region closest to you
4. Click "Create Cluster"
5. Wait 2-3 minutes for cluster to be ready

### 1.3 Get Connection String

1. Click "Connect"
2. Select "Connection Parameters"
3. Copy the SQL connection string
4. It looks like:
   ```
   postgresql://user:password@cluster-name.cockroachdb.cloud:26257/defaultdb?sslmode=require
   ```

**Save this connection string!** You'll need it for HF Spaces.

## Step 2: Create Hugging Face Space

### 2.1 Go to Spaces

1. Log in to [https://huggingface.co](https://huggingface.co)
2. Click on your profile → "Spaces"
3. Click "Create new Space"

### 2.2 Configure Space

**Space Settings:**

- **Space name**: `waha-whatsapp` (or your choice)
- **Visibility**: Public (or Private)
- **Space SDK**: Docker
- **Hardware**: CPU basic (or GPU if you want)

**Click "Create Space"**

### 2.3 Enable Persistent Storage

⚠️ **Important for session persistence!**

1. Go to Space Settings → Persistent Storage
2. Click "Enable Persistent Storage"
3. Storage size: 10GB (free tier)
4. Mount path: `/data`
5. Save

Now your sessions will survive container restarts!

## Step 3: Add Environment Variables

### 3.1 Go to Secrets

1. In Space Settings → Variables and Secrets
2. Click "Add Variable"

### 3.2 Add Each Variable

Add all variables one by one:

| Name                               | Value                              | Example                                                                         | Type              |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- | ----------------- |
| `WHATSAPP_SESSIONS_POSTGRESQL_URL` | Your CockroachDB connection string | `postgresql://user:password@cluster.cockroachdb.cloud:26257/db?sslmode=require` | Secret            |
| `WAHA_MEDIA_POSTGRESQL_URL`        | Same as above                      | `postgresql://user:password@cluster.cockroachdb.cloud:26257/db?sslmode=require` | Secret            |
| `WAHA_MEDIA_STORAGE`               | `postgresql`                       | `postgresql`                                                                    | Public            |
| `WHATSAPP_DEFAULT_ENGINE`          | `GOWS`                             | `GOWS`                                                                          | Public            |
| `PORT`                             | `3000`                             | `3000`                                                                          | Public            |
| `WHATSAPP_API_KEY_EXCLUDE_PATH`    | `ping,health`                      | `ping,health`                                                                   | Public            |
| `NODE_OPTIONS`                     | `--max-old-space-size=512`         | `--max-old-space-size=512`                                                      | Public            |
| `WAHA_DASHBOARD_USERNAME`          | `admin`                            | `admin`                                                                         | Public            |
| `WAHA_DASHBOARD_PASSWORD`          | Your strong password               | `secure123!@#`                                                                  | Secret            |
| `WHATSAPP_HOOK_URL`                | Your webhook URL                   | `https://your-webhook.hf.space/webhook`                                         | Secret (Optional) |
| `WAHA_API_KEY`                     | Your API key                       | `arijit_waha_2026`                                                              | Secret (Optional) |

**Note:**

- Use "Secret" for sensitive values
- "Public" is safe for non-sensitive config
- Mark optional ones based on your needs

## Step 4: Upload Repository

### 4.1 Option A: Git Push (Recommended)

```bash
# Clone your HF space
git clone https://huggingface.co/spaces/your-username/waha-whatsapp
cd waha-whatsapp

# Copy all files from this project
cp -r /path/to/this/repo/* .

# Push to HF
git add .
git commit -m "Initial WAHA CockroachDB setup for HF Spaces"
git push
```

### 4.2 Option B: Manual Upload

1. Click "Files" tab in your Space
2. Click "Add file" → "Upload files"
3. Upload:

   - `Dockerfile`
   - `sync.js`
   - `package.json`
   - `start.sh`
   - `render.yaml`
   - `README.md`
   - `.env.example`

4. Create `Dockerfile` directly if needed

## Step 5: Wait for Build

1. HF Spaces will automatically build your Docker image
2. Check "Logs" tab to see build progress
3. Build typically takes 5-10 minutes
4. Wait until you see "Running" status

## Step 6: Verify Deployment

### 6.1 Check Main App

Visit: `https://your-username-waha-whatsapp.hf.space/`

You should see the WAHA dashboard.

### 6.2 Check Health Endpoint

```bash
curl https://your-username-waha-whatsapp.hf.space/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "cockroachdb",
  "component": "waha-sync",
  "data": {
    "sessions": { "count": 0, "total_size_bytes": 0 },
    "media": { "count": 0, "total_size_bytes": 0 }
  }
}
```

### 6.3 Check Monitoring Dashboard

Visit: `https://your-username-waha-whatsapp.hf.space:3001/`

You should see:

- Status: CONNECTED
- Database: cockroachdb
- Stored Sessions: (showing count)
- Real-time charts

## Step 7: Start Using WhatsApp API

### 7.1 Get Your API Key

Check the Space logs for your auto-generated API key:

- Click "Logs" tab
- Search for "WAHA_API_KEY"
- Or use the one you set in variables

### 7.2 Start a Session

```bash
curl -X POST https://your-username-waha-whatsapp.hf.space/sessions/start \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "default"}'
```

Response should show QR code URL.

### 7.3 Get QR Code

```bash
curl https://your-username-waha-whatsapp.hf.space/sessions/default/qr \
  -H "X-API-Key: your-api-key"
```

Scan the QR code with your WhatsApp app.

### 7.4 Check Status

```bash
curl https://your-username-waha-whatsapp.hf.space/sessions/default/me \
  -H "X-API-Key: your-api-key"
```

Shows your WhatsApp profile information once authenticated.

## API Examples

### Send a Message

```bash
curl -X POST https://your-space.hf.space/messages/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "default",
    "chatId": "1234567890@c.us",
    "text": "Hello from WAHA!"
  }'
```

### Send Media

```bash
curl -X POST https://your-space.hf.space/messages/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "default",
    "chatId": "1234567890@c.us",
    "media": {
      "url": "https://example.com/image.jpg"
    }
  }'
```

### Listen to Messages (Webhook)

If you set `WHATSAPP_HOOK_URL`:

```javascript
// Your webhook server receives:
{
  "event": "message",
  "data": {
    "sessionId": "default",
    "message": {
      "id": "3EA0...",
      "from": "1234567890@c.us",
      "text": "Hello!",
      "timestamp": 1234567890
    }
  }
}
```

## Monitoring & Troubleshooting

### 1. Check Dashboard

Visit: `:3001/` to see real-time stats

### 2. View Logs

```bash
# View build logs
https://your-username-waha-whatsapp.hf.space/logs

# Check for errors
# Look for [SYNC], [ERROR], or [DB] prefixes
```

### 3. Health Check

```bash
# Health endpoint
curl https://your-username-waha-whatsapp.hf.space/health

# Status endpoint
curl https://your-username-waha-whatsapp.hf.space/status
```

### 4. Common Issues

**Issue: "Database connection failed"**

- Check connection string in Variables & Secrets
- Verify CockroachDB cluster is running
- Check IP whitelist in CockroachDB console

**Issue: "Sessions not persisting"**

- Verify Persistent Storage is enabled
- Check mount path is `/data`
- Sessions will sync to persistent storage automatically

**Issue: "Health check returns 500"**

- Check CockroachDB connection
- Wait 30 seconds and retry
- Check Space logs for errors

**Issue: "Port 3001 not accessible"**

- Some hosting providers block non-standard ports
- Use port 3000 endpoints instead
- Configure through `/health` endpoint

## Performance Tips

1. **Use Persistent Storage**: Already enabled ✅
2. **Set Optimal Timeout**: `NODE_OPTIONS=--max-old-space-size=512`
3. **Monitor Health**: Check `/health` every 5 minutes
4. **Backup Sessions**: Periodically export from CockroachDB
5. **Clean Old Files**: Sessions older than 30 days can be archived

## Security Best Practices

1. ✅ **Never share API key** - Store in HF Secrets
2. ✅ **Use HTTPS only** - HF Spaces provides HTTPS
3. ✅ **Validate webhooks** - If using webhook integration
4. ✅ **Strong password** - For dashboard access
5. ✅ **Limit API endpoints** - Use `WHATSAPP_API_KEY_EXCLUDE_PATH`

## Scaling Your Deployment

As you grow:

1. **CockroachDB**: Automatically scales, no action needed
2. **Session Limit**: Can handle 100+ concurrent sessions
3. **API Rate Limit**: Adjust in WAHA configuration
4. **Storage**: Persistent storage auto-expands

## Backup & Export

### Export Sessions from CockroachDB

```bash
# Connect to CockroachDB
psql "postgresql://user:pass@cluster.cockroachdb.cloud:26257/defaultdb?sslmode=require" \
  -c "SELECT * FROM sessions;" > sessions_backup.csv
```

### Download Persistent Storage

1. Go to Space Settings → Persistent Storage
2. Click "Download" to get all stored files

## Update Your Deployment

When you update the code:

```bash
git add .
git commit -m "Update WAHA configuration"
git push
```

HF Spaces will automatically rebuild and deploy!

## Next Steps

1. ✅ Start using the API
2. ✅ Set up webhook integration
3. ✅ Monitor with health checks
4. ✅ Integrate with n8n or other services
5. ✅ Scale to production

## Support

For issues:

- Check [WAHA Documentation](https://github.com/devlikeapro/waha)
- Visit [CockroachDB Docs](https://www.cockroachlabs.com/docs/)
- Check HF Spaces documentation
- View logs at `:3001/` dashboard

Enjoy your WhatsApp bot! 🚀
