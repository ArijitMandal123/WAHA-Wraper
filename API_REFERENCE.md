# API Quick Reference

Fast lookup for common WAHA API endpoints and their usage.

## Base URLs

```
Development: http://localhost:3000
Production: https://your-space.hf.space
Health Check: http://localhost:3001/health
Dashboard: http://localhost:3001/
```

## Authentication

All requests require `X-API-Key` header:

```bash
-H "X-API-Key: your-api-key"
```

Exceptions: `/health`, `/status`, `/` (dashboard)

## Core Endpoints

### Sessions

#### Start Session

```bash
POST /sessions/start
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default"
}
```

Response: `sessionId`, QR code URL

#### Get QR Code

```bash
GET /sessions/{sessionId}/qr
-H "X-API-Key: YOUR_KEY"
```

Response: QR code as image/PNG

#### Get Session Status

```bash
GET /sessions/{sessionId}/me
-H "X-API-Key: YOUR_KEY"
```

Response: WhatsApp profile info

#### List All Sessions

```bash
GET /sessions
-H "X-API-Key: YOUR_KEY"
```

Response: Array of session objects

#### Stop Session

```bash
DELETE /sessions/{sessionId}
-H "X-API-Key: YOUR_KEY"
```

Response: Success message

### Messages

#### Send Text

```bash
POST /messages/send
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "chatId": "1234567890@c.us",
  "text": "Hello!"
}
```

#### Send Image

```bash
POST /messages/send
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "chatId": "1234567890@c.us",
  "media": {
    "url": "https://example.com/image.jpg"
  }
}
```

#### Send File

```bash
POST /messages/send
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "chatId": "1234567890@c.us",
  "media": {
    "url": "https://example.com/file.pdf",
    "caption": "Check this PDF"
  }
}
```

#### Send Video

```bash
POST /messages/send
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "chatId": "1234567890@c.us",
  "media": {
    "url": "https://example.com/video.mp4"
  }
}
```

#### Send Audio/Voice

```bash
POST /messages/send
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "chatId": "1234567890@c.us",
  "media": {
    "url": "https://example.com/audio.mp3",
    "mimetype": "audio/mpeg"
  }
}
```

#### React to Message

```bash
POST /messages/{messageId}/reactions
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "emoji": "👍"
}
```

### Contacts

#### Get Contact Info

```bash
GET /contacts/{contactId}
-H "X-API-Key: YOUR_KEY"
```

#### Get All Contacts

```bash
GET /contacts
-H "X-API-Key: YOUR_KEY"
```

### Groups

#### Create Group

```bash
POST /groups
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "name": "My Group",
  "members": ["1234567890@c.us", "0987654321@c.us"]
}
```

#### Add Member

```bash
POST /groups/{groupId}/members/add
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "members": ["1234567890@c.us"]
}
```

#### Remove Member

```bash
POST /groups/{groupId}/members/remove
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "members": ["1234567890@c.us"]
}
```

### Chat Operations

#### Mark Read

```bash
POST /chats/{chatId}/mark-read
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default"
}
```

#### Archive Chat

```bash
POST /chats/{chatId}/archive
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default"
}
```

#### Mute Notifications

```bash
POST /chats/{chatId}/mute
-H "X-API-Key: YOUR_KEY"
{
  "sessionId": "default",
  "duration": 28800  // 8 hours in seconds
}
```

## Monitoring Endpoints

### Health Check

```bash
GET /health
```

Status code: 200 (healthy) or 500 (error)

```json
{
  "status": "ok",
  "database": "cockroachdb",
  "data": {
    "sessions": { "count": 5, "total_size_bytes": 245000 },
    "media": { "count": 12, "total_size_bytes": 1500000 }
  }
}
```

### Status Dashboard

```bash
GET /status
```

Detailed session and file information

### Web Dashboard

```
GET /
Visit: http://localhost:3001/
```

Real-time monitoring dashboard

## Chat ID Formats

| Type       | Format            | Example         |
| ---------- | ----------------- | --------------- |
| Individual | Phone@c.us        | 1234567890@c.us |
| Group      | Group ID@g.us     | 120363XXX@g.us  |
| Broadcast  | Broadcast ID      | broadcastXXX    |
| Myself     | "me" or sessionId | "me"            |

## Common cURL Examples

### Send Hello Message

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

### Check Health

```bash
curl http://localhost:3001/health | jq .
```

### Get All Sessions

```bash
curl http://localhost:3000/sessions \
  -H "X-API-Key: your-api-key" | jq .
```

### Send Image with Caption

```bash
curl -X POST http://localhost:3000/messages/send \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "default",
    "chatId": "1234567890@c.us",
    "media": {
      "url": "https://example.com/image.jpg",
      "caption": "Check this image!"
    }
  }'
```

## Webhook Integration

### Receive Messages

Set `WHATSAPP_HOOK_URL` environment variable:

```env
WHATSAPP_HOOK_URL=https://your-webhook-handler.com/webhook
```

Your webhook will receive:

```json
{
  "event": "message",
  "data": {
    "sessionId": "default",
    "message": {
      "id": "3EB0B4C...",
      "from": "1234567890@c.us",
      "to": "me",
      "text": "Hello!",
      "type": "chat",
      "timestamp": 1234567890,
      "fromMe": false
    }
  }
}
```

## Error Responses

### 401 - Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

### 404 - Not Found

```json
{
  "error": "Not Found",
  "message": "Session not found"
}
```

### 500 - Server Error

```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

## Rate Limits

- Messages: 100 per second per session
- API Calls: 1000 per second
- File Upload: 100MB max per file

## Timeout Values

- Connection timeout: 30s
- Request timeout: 60s
- Long polling: 30s

## Response Status Codes

| Code | Meaning             |
| ---- | ------------------- |
| 200  | Success             |
| 201  | Created             |
| 400  | Bad Request         |
| 401  | Unauthorized        |
| 403  | Forbidden           |
| 404  | Not Found           |
| 500  | Server Error        |
| 503  | Service Unavailable |

## Testing with Postman

1. Create new collection
2. Set `base_url` variable to your endpoint
3. Set `api_key` variable to your API key
4. Use these pre-filled requests:

```
GET {{base_url}}/health

GET {{base_url}}/sessions
Header: X-API-Key: {{api_key}}

POST {{base_url}}/messages/send
Header: X-API-Key: {{api_key}}
Body: {
  "sessionId": "default",
  "chatId": "1234567890@c.us",
  "text": "Hello"
}
```

## JavaScript Client Example

```javascript
const API_KEY = "your-api-key";
const BASE_URL = "http://localhost:3000";

async function sendMessage(chatId, text) {
  const response = await fetch(`${BASE_URL}/messages/send`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: "default",
      chatId: chatId,
      text: text,
    }),
  });
  return response.json();
}

// Usage
sendMessage("1234567890@c.us", "Hello!");
```

## Python Client Example

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'http://localhost:3000'

def send_message(chat_id, text):
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    data = {
        'sessionId': 'default',
        'chatId': chat_id,
        'text': text
    }
    response = requests.post(
        f'{BASE_URL}/messages/send',
        headers=headers,
        json=data
    )
    return response.json()

# Usage
send_message('1234567890@c.us', 'Hello!')
```

---

**For complete API documentation**, visit the WAHA project:
https://github.com/devlikeapro/waha
