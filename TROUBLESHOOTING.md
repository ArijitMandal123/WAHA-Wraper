# Troubleshooting Guide

Solutions to common issues when deploying WAHA with CockroachDB.

## Database Connection Issues

### "Error: connect ECONNREFUSED"

**Cause:** Database unreachable

**Solutions:**

1. Check connection string format:

   ```
   postgresql://user:password@host:26257/db?sslmode=require
   ```

2. Verify CockroachDB cluster is running:

   - Log into https://cockroachlabs.cloud
   - Check cluster status (should be "Available")

3. Check IP whitelist:

   - In CockroachDB console
   - Security → SQL Users
   - Allow your IP address

4. Verify credentials:

   - Username and password are correct
   - No special characters need escaping

5. Test connection locally:
   ```bash
   psql "postgresql://user:pass@host:26257/db?sslmode=require"
   ```

### "Error: ENOTFOUND cluster.cockroachdb.cloud"

**Cause:** DNS resolution failed

**Solutions:**

1. Check internet connection
2. Verify hostname spelling
3. Check if CockroachDB servers are accessible
4. Try using IP address instead of hostname (if available)

### "Error: ssl: certificate verify failed"

**Cause:** SSL certificate issue

**Solutions:**

1. Ensure `sslmode=require` in connection string
2. CockroachDB requires SSL - don't use `sslmode=disable`
3. Update Node.js to latest version
4. Check system clock is correct (SSL validation requires time sync)

### "Error: password authentication failed"

**Cause:** Wrong credentials

**Solutions:**

1. Reset password in CockroachDB console
2. Verify exact password (case-sensitive)
3. Check for hidden characters
4. Try without special characters first
5. Re-copy connection string from CockroachDB console

## Sessions Not Persisting

### Sessions disappear after restart

**Check:**

1. Is `/app/.sessions` directory mounted?

   ```bash
   ls -la /app/.sessions
   ```

2. Are file permissions correct?

   ```bash
   chmod 755 /app/.sessions
   ```

3. Is disk space available?

   ```bash
   df -h
   ```

4. Check HF Spaces persistent storage:
   - Go to Settings → Persistent Storage
   - Should show "Enabled"
   - Mount path should be `/data`

**Solution:**

```bash
# Re-enable persistent storage
# Space Settings → Persistent Storage → Enable
```

### Health check shows 0 sessions

**Check:**

1. Have you scanned QR code?

   ```bash
   curl http://localhost:3001/status
   ```

2. Is session file in correct directory?

   ```bash
   ls /app/.sessions/
   ```

3. Are there any upload errors in logs?
   ```bash
   docker logs <container-id> | grep SYNC
   ```

**Solution:**

1. Start fresh session: `POST /sessions/start`
2. Scan QR code
3. Wait 5 seconds
4. Check status: `GET /status`

## Health Check Issues

### `/health` returns 500 error

**Cause:** Database connection failed

**Steps to fix:**

1. Verify database is running
2. Check connection string is correct
3. Verify network connectivity
4. Check IP whitelist in CockroachDB

**Check logs:**

```bash
docker logs <container-id> | grep -i error
```

### `/health` shows wrong data

**Issue:** Old or stale data

**Solution:**

1. Force refresh: `curl http://localhost:3001/health`
2. Check if sync process is running
3. Monitor dashboard: `http://localhost:3001/`

### Health endpoint not responding

**Cause:** Service not running

**Steps:**

1. Check if Docker container is running:

   ```bash
   docker ps | grep waha
   ```

2. Check if port 3001 is open:

   ```bash
   netstat -an | grep 3001
   ```

3. Restart container:
   ```bash
   docker restart <container-id>
   ```

## Deployment Issues

### HF Spaces build fails

**Check logs:**

1. Go to Space → Logs
2. Search for "ERROR" or "failed"

**Common causes:**

- `npm install` fails: Check internet connection
- Missing environment variables: Add to Secrets
- Dockerfile syntax error: Verify format

**Solution:**

```bash
# Test locally
docker build -t waha .
```

### HF Spaces never reaches "Running"

**Cause:** Long build or infinite loop

**Steps:**

1. Wait 10+ minutes (first build is slow)
2. Check logs for hanging process
3. Stop and restart build: Settings → Restart space

### Port 3001 not accessible on HF Spaces

**Cause:** Some hosting providers block non-standard ports

**Workaround:**

1. Use `/health` endpoint on port 3000:

   ```bash
   curl https://your-space.hf.space/health
   ```

2. Use dashboard through web interface
3. All monitoring through port 3000 endpoints

## File Upload/Download Issues

### Files not syncing to database

**Check:**

1. Is file watcher running?

   ```bash
   docker logs <container-id> | grep "watch mode"
   ```

2. Check file size limit (max 10MB):

   ```bash
   ls -lh /app/.sessions/
   ```

3. Check file permissions:
   ```bash
   chmod 644 /app/.sessions/*
   ```

**Solution:**

1. Restart sync service
2. Check database connection
3. Review logs for errors

### Files stuck in upload

**Check:**

1. Database connection status
2. File size (should be < 10MB)
3. Available disk space

**Force retry:**

```bash
# Touch file to trigger re-sync
touch /app/.sessions/filename
```

### High CPU usage during sync

**Cause:** Large file operations

**Solutions:**

1. Adjust hash algorithm (currently SHA-256)
2. Increase debounce delay in sync.js (currently 2s)
3. Split large files

**In sync.js:**

```javascript
// Increase debounce delay from 2000ms to 5000ms
setTimeout(() => uploadSession(filePath), 5000);
```

## API Issues

### 401 Unauthorized

**Cause:** Wrong or missing API key

**Solution:**

```bash
# Check your API key
echo $WAHA_API_KEY

# Use correct header
curl -H "X-API-Key: your-actual-key" http://localhost:3000/sessions
```

### 404 Session Not Found

**Cause:** Session doesn't exist

**Solution:**

1. List existing sessions:

   ```bash
   curl http://localhost:3000/sessions \
     -H "X-API-Key: your-key"
   ```

2. Create session if needed:
   ```bash
   curl -X POST http://localhost:3000/sessions/start \
     -H "X-API-Key: your-key" \
     -d '{"sessionId": "default"}'
   ```

### QR Code Not Displaying

**Cause:** Session not initialized

**Steps:**

1. Start session first:

   ```bash
   POST /sessions/start → {"sessionId": "default"}
   ```

2. Wait 2 seconds
3. Get QR code:

   ```bash
   GET /sessions/default/qr
   ```

4. Should return image

## Docker Issues

### "Cannot connect to Docker daemon"

**Solutions:**

1. Ensure Docker is running
2. On Windows/Mac: Start Docker Desktop
3. Check permissions (may need sudo)

### "Image not found"

**Cause:** Image not built

**Solution:**

```bash
docker build -t waha .
```

### "Container exited with code 1"

**Cause:** Application error at startup

**Check logs:**

```bash
docker logs <container-id>
```

**Common causes:**

- Missing environment variables
- Database connection failed
- Syntax error in code

### Out of memory

**Increase limit:**

```bash
docker run ... -e NODE_OPTIONS="--max-old-space-size=1024" waha
```

## Performance Issues

### Slow API responses

**Check:**

1. Database query time (use `/health`)
2. Network latency
3. Local resources (CPU, RAM)

**Optimize:**

1. Increase Node.js memory:

   ```env
   NODE_OPTIONS=--max-old-space-size=1024
   ```

2. Enable connection pooling (already enabled)
3. Reduce log verbosity

### High latency on /health

**Normal**: < 100ms
**Acceptable**: < 500ms
**Problem**: > 1s

**Solutions:**

1. Check database connection
2. Verify network speed
3. Look for slow queries in logs

### Sessions taking long to start

**Check:**

1. QR code URL generation time
2. WhatsApp connection speed
3. Network latency

**Typical timing:**

- QR generation: 1-2 seconds
- WhatsApp auth: 30-60 seconds
- Full ready: 2-5 minutes

## Webhook Integration Issues

### Webhooks not being received

**Check:**

1. `WHATSAPP_HOOK_URL` is set
2. Webhook URL is publicly accessible
3. No firewall blocking requests
4. Webhook server is running

**Test:**

```bash
# Send test webhook
curl -X POST https://your-webhook.com/test \
  -d '{"test": "data"}'
```

### Webhook retries not working

**Cause:** Webhook server down

**Check:**

1. Is webhook endpoint running?
2. Does it return 200 OK?
3. Check webhook logs

### Duplicate webhook events

**Cause:** Network retry

**Solution:**

1. Use event IDs for deduplication
2. Implement idempotent handlers

## Data Issues

### Wrong data showing in dashboard

**Cause:** Cache not updated

**Solution:**

1. Refresh browser: F5
2. Clear browser cache: Ctrl+Shift+Delete
3. Check actual database

**View database directly:**

```bash
psql "postgresql://..." \
  -c "SELECT * FROM sessions LIMIT 5;"
```

### Database growing too fast

**Cause:** Files too large

**Check:**

1. File sizes: `ls -lh /app/.sessions/`
2. Remove old files: `rm -f /app/.sessions/old_*`
3. Check file size limit

**Solution:**

```javascript
// In sync.js, increase size limit from 10MB
if (fileSizeBytes > 50 * 1024 * 1024) {
  // 50MB
  console.log(`Skipping ${filename} - file too large`);
  return;
}
```

## Network Issues

### Can't reach http://localhost:3000

**On Windows:**

```bash
# Use your machine IP instead
curl http://192.168.x.x:3000/health
```

### Firewall blocking ports

**Windows:**

```bash
# Allow port 3000 through firewall
netsh advfirewall firewall add rule name="WAHA" dir=in action=allow protocol=tcp localport=3000
```

**Linux:**

```bash
sudo ufw allow 3000
sudo ufw allow 3001
```

## Getting Help

1. **Check Logs First:**

   ```bash
   docker logs <container-id> | tail -100
   ```

2. **Enable Debug Mode:**

   ```env
   DEBUG=*
   ```

3. **Test Connectivity:**

   ```bash
   npm run test-connection
   ```

4. **View Dashboard:**
   Visit `http://localhost:3001/`

5. **Create Issue:**
   Include:
   - Docker version
   - Node version
   - Full error message
   - Environment variables (without secrets)

---

Still stuck? Check the main documentation:

- [README.md](README.md) - Full guide
- [HUGGING_FACE_SETUP.md](HUGGING_FACE_SETUP.md) - HF setup
- [MIGRATION.md](MIGRATION.md) - Migration help
- [QUICKSTART.md](QUICKSTART.md) - Quick start
