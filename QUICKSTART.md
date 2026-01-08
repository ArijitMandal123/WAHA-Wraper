# Quick Start Guide

Get WAHA with CockroachDB running in 5 minutes.

## 30-Second Setup

```bash
# 1. Clone/Download this project
git clone <repo> && cd waha-wrapper

# 2. Copy environment template
cp .env.example .env

# 3. Add your CockroachDB connection string to .env
# WHATSAPP_SESSIONS_POSTGRESQL_URL=postgresql://...

# 4. Build and run
docker build -t waha .
docker run -p 3000:3000 -p 3001:3001 \
  --env-file .env \
  waha
```

## What's Running?

- **Port 3000**: WAHA WhatsApp API
- **Port 3001**: Monitoring Dashboard + Health Endpoints

## First Steps

### 1. Check Health

```bash
curl http://localhost:3001/health
```

Should return: `"status": "ok"`

### 2. View Dashboard

Visit: `http://localhost:3001/`

See real-time database stats!

### 3. Start WhatsApp Session

```bash
# Get QR code
curl -X POST http://localhost:3000/sessions/start \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "default"}'

# Get QR URL
curl http://localhost:3000/sessions/default/qr \
  -H "X-API-Key: your-api-key"
```

Scan QR code with WhatsApp! ✅

### 4. Send Message

```bash
curl -X POST http://localhost:3000/messages/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "default",
    "chatId": "1234567890@c.us",
    "text": "Hello from WAHA!"
  }'
```

## Common Commands

```bash
# Test database connection
npm run test-connection

# View all endpoints
curl http://localhost:3000/docs

# Get session status
curl http://localhost:3000/sessions/default/me \
  -H "X-API-Key: your-api-key"

# List all sessions
curl http://localhost:3000/sessions \
  -H "X-API-Key: your-api-key"
```

## Need CockroachDB?

1. Visit: https://cockroachlabs.cloud
2. Sign up (free)
3. Create cluster (2 min)
4. Copy connection string
5. Paste into .env

## Deploying to Hugging Face?

See: [HUGGING_FACE_SETUP.md](HUGGING_FACE_SETUP.md)

## More Help?

- Full Guide: [README.md](README.md)
- Migration from MongoDB: [MIGRATION.md](MIGRATION.md)
- API Docs: See `/docs` endpoint

---

**You're all set! Start building your WhatsApp bot now! 🚀**
