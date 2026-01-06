## 🎯 Goal

Create a custom Dockerized version of **WAHA Core** (WhatsApp HTTP API) that persists session data to **MongoDB Atlas** using a custom sync script. This is required because Render's Free Tier deletes local files on every restart, causing WhatsApp logouts.

## 🏗️ Project Architecture

1. **Base Image:** `devlikeapro/waha:latest`
2. **Sync Engine:** A Node.js "Sidecar" script (`sync.js`).
3. **Storage:** MongoDB GridFS (to store binary session files).
4. **Process Manager:** A shell script (`start.sh`) to coordinate the sync and the WAHA service.

---

## 🛠️ Task List for AI Agent

### 1. File Structure Setup

Create a project folder with the following files:

- `sync.js`: The logic for uploading/downloading files between `/app/.sessions` and MongoDB.
- `package.json`: Dependencies for the sync script (`mongodb`, `chokidar`, `fs-extra`).
- `start.sh`: Execution script for the container.
- `Dockerfile`: The instructions to build the modified image.

### 2. Implementation Details for `sync.js`

- **Download Phase:** On startup, the script must check the MongoDB database. If files exist, it must download them to `/app/.sessions` before WAHA starts.
- **Upload Phase:** Use a "Watcher" (chokidar) to monitor the `/app/.sessions` folder. Whenever a file is created or modified, it must be uploaded to MongoDB GridFS.
- **Error Handling:** Use `try-catch` blocks to ensure the script doesn't crash if MongoDB is temporarily unreachable.

### 3. Implementation Details for `start.sh`

The script must perform these actions in order:

1. `node sync.js --download` (Wait for this to finish).
2. `node sync.js --watch &` (Run the watcher in the background).
3. `exec /app/entrypoint.sh` (Hand over control to the official WAHA engine).

### 4. Dockerfile Requirements

- Start `FROM devlikeapro/waha`.
- Switch to `USER root` to install `nodejs` and `npm`.
- Install dependencies.
- Copy the custom scripts into `/app`.
- Expose `PORT 3000`.
- Set `CMD ["./start.sh"]`.

---

## 🚀 Deployment Parameters (For Render)

The agent should provide a list of the required **Environment Variables** for Render:

- `WHATSAPP_SESSIONS_MONGO_URL`: The MongoDB Atlas connection string.
- `WHATSAPP_DEFAULT_ENGINE`: Set to `GOWS` (Lightweight for 512MB RAM).
- `PORT`: `3000`.
- `WHATSAPP_API_KEY_EXCLUDE_PATH`: `ping,health` (To allow uptime monitors).

---

## 🛡️ Error-Proofing Instructions

- **Concurrency:** Ensure the sync script handles "file busy" errors (common when WhatsApp is writing to the session files).
- **Debouncing:** Add a small delay (1-2 seconds) before uploading a changed file to avoid uploading incomplete data.
- **Logs:** The script should output clear logs like `[SYNC] Uploading session key...` so the user can see it working in the Render logs.

---
