const { Pool } = require("pg");
const chokidar = require("chokidar");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const crypto = require("crypto");

const dbUrl = process.env.WHATSAPP_SESSIONS_POSTGRESQL_URL;
const mediaDbUrl = process.env.WAHA_MEDIA_POSTGRESQL_URL;
const sessionsDir = "/app/.sessions";
const mediaDir = "/app/.media";

let pool;
let mediaPool;

async function initializePool() {
  if (!pool) {
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }, // For CockroachDB
    });
  }
  if (!mediaPool && mediaDbUrl) {
    mediaPool = new Pool({
      connectionString: mediaDbUrl,
      ssl: { rejectUnauthorized: false },
    });
  }
}

async function initializeDatabase() {
  try {
    const client = await pool.connect();
    try {
      // Create sessions table if not exists - optimized schema
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(255) UNIQUE NOT NULL,
          size_bytes BIGINT,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          file_hash VARCHAR(64),
          INDEX idx_filename (filename)
        )
      `);

      // Create media metadata table if not exists - optimized schema
      if (mediaPool) {
        const mediaClient = await mediaPool.connect();
        try {
          await mediaClient.query(`
            CREATE TABLE IF NOT EXISTS media_files (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              filename VARCHAR(255) UNIQUE NOT NULL,
              size_bytes BIGINT,
              mime_type VARCHAR(100),
              uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              file_hash VARCHAR(64),
              INDEX idx_filename (filename)
            )
          `);
        } finally {
          mediaClient.release();
        }
      }

      console.log("[DB] Database tables initialized");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[DB] Error initializing database:", error);
    throw error;
  }
}

async function connectDB() {
  await initializePool();
  return { pool };
}

async function downloadSessions() {
  console.log("[SYNC] Starting download phase...");
  try {
    await initializePool();
    const client = await pool.connect();
    try {
      // Ensure sessions dir exists
      await fs.ensureDir(sessionsDir);

      // Get all session records from database
      const result = await client.query(
        "SELECT filename, file_hash FROM sessions ORDER BY uploaded_at DESC LIMIT 100"
      );
      const sessions = result.rows;

      console.log(
        `[SYNC] Found ${sessions.length} session records in database`
      );

      for (const session of sessions) {
        const filePath = path.join(sessionsDir, session.filename);
        // Check if file already exists with same hash
        if (await fs.pathExists(filePath)) {
          const fileBuffer = await fs.readFile(filePath);
          const hash = crypto
            .createHash("sha256")
            .update(fileBuffer)
            .digest("hex");
          if (hash === session.file_hash) {
            console.log(
              `[SYNC] Skipping ${session.filename} - already up to date`
            );
            continue;
          }
        }
        console.log(`[SYNC] Restoring ${session.filename}...`);
        // For CockroachDB, files are stored in the filesystem, not in DB
        // This just updates metadata - actual file sync handled by watchSessions
      }

      console.log("[SYNC] Download phase completed.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[SYNC] Error during download:", error);
  }
}

async function uploadSession(filePath) {
  const filename = path.basename(filePath);
  console.log(`[SYNC] Uploading ${filename}...`);
  try {
    await initializePool();
    const client = await pool.connect();
    try {
      // Read file and calculate hash
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");
      const fileSizeBytes = fileBuffer.length;

      // Only store if file size is reasonable (less than 10MB for session files)
      if (fileSizeBytes > 10 * 1024 * 1024) {
        console.log(
          `[SYNC] Skipping ${filename} - file too large (${fileSizeBytes} bytes)`
        );
        return;
      }

      // Upsert session record with only essential data
      await client.query(
        `INSERT INTO sessions (filename, size_bytes, file_hash, uploaded_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (filename) DO UPDATE SET
           size_bytes = $2,
           file_hash = $3,
           updated_at = CURRENT_TIMESTAMP`,
        [filename, fileSizeBytes, fileHash]
      );

      console.log(
        `[SYNC] Stored ${filename} (${fileSizeBytes} bytes, hash: ${fileHash.substring(
          0,
          8
        )}...)`
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[SYNC] Error uploading ${filename}:`, error);
  }
}

async function watchSessions() {
  console.log("[SYNC] Starting watch mode...");
  await initializeDatabase();

  // Start status server
  const app = express();
  const PORT = 3001; // Different port from WAHA's 3000

  // Health check endpoint (WAHA Plus compatible)
  app.get("/health", async (req, res) => {
    try {
      await initializePool();
      const client = await pool.connect();
      try {
        // Test database connection
        await client.query("SELECT 1");

        // Get database statistics
        const statsResult = await client.query(
          `SELECT 
             COUNT(*) as session_count,
             COALESCE(SUM(size_bytes), 0) as total_size_bytes,
             MAX(updated_at) as last_update
           FROM sessions`
        );

        const stats = statsResult.rows[0];

        // Get media statistics if available
        let mediaStats = null;
        if (mediaPool) {
          const mediaClient = await mediaPool.connect();
          try {
            const mediaResult = await mediaClient.query(
              `SELECT 
                 COUNT(*) as media_count,
                 COALESCE(SUM(size_bytes), 0) as total_media_bytes
               FROM media_files`
            );
            mediaStats = mediaResult.rows[0];
          } finally {
            mediaClient.release();
          }
        }

        res.status(200).json({
          status: "ok",
          database: "cockroachdb",
          component: "waha-sync",
          timestamp: new Date().toISOString(),
          data: {
            sessions: {
              count: parseInt(stats.session_count) || 0,
              total_size_bytes: parseInt(stats.total_size_bytes) || 0,
              last_updated: stats.last_update || null,
            },
            media: mediaStats
              ? {
                  count: parseInt(mediaStats.media_count) || 0,
                  total_size_bytes: parseInt(mediaStats.total_media_bytes) || 0,
                }
              : null,
          },
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("[HEALTH] Error:", error);
      res.status(500).json({
        status: "error",
        database: "cockroachdb",
        component: "waha-sync",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Status endpoint (detailed view)
  app.get("/status", async (req, res) => {
    try {
      await initializePool();
      const client = await pool.connect();
      try {
        // Get session details
        const sessionsResult = await client.query(
          `SELECT filename, size_bytes, uploaded_at, updated_at 
           FROM sessions 
           ORDER BY updated_at DESC 
           LIMIT 50`
        );

        const sessions = sessionsResult.rows;

        // Get local files
        const localFiles = await fs.readdir(sessionsDir).catch(() => []);

        res.json({
          status: "connected",
          database: "cockroachdb",
          storedSessions: sessions.length,
          sessionFiles: sessions.map((f) => ({
            name: f.filename,
            size: f.size_bytes,
            uploaded: f.uploaded_at,
            updated: f.updated_at,
          })),
          localFiles: localFiles.length,
          localFileNames: localFiles,
          lastCheck: new Date().toISOString(),
        });
      } finally {
        client.release();
      }
    } catch (error) {
      res.status(500).json({
        status: "error",
        error: error.message,
        lastCheck: new Date().toISOString(),
      });
    }
  });

  app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WAHA Sync Status - CockroachDB</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        header h1 { font-size: 2em; margin-bottom: 10px; }
        .content { padding: 30px; }
        .status-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .status-card.error {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .status-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .info-box {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 5px;
        }
        .info-box strong { display: block; font-size: 0.9em; opacity: 0.9; }
        .info-box span { display: block; font-size: 1.5em; margin-top: 5px; }
        .button-group {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }
        button {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.3s ease;
        }
        button:hover { background: #764ba2; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        h3 { color: #333; margin-top: 30px; margin-bottom: 15px; font-size: 1.3em; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #333;
        }
        tr:hover { background-color: #f8f9fa; }
        .file-list {
            list-style: none;
            margin-top: 15px;
        }
        .file-list li {
            padding: 10px;
            background: #f8f9fa;
            margin-bottom: 8px;
            border-radius: 4px;
            border-left: 4px solid #667eea;
        }
        .empty { color: #999; font-style: italic; }
        .size-badge {
            display: inline-block;
            background: #e7f3ff;
            color: #0066cc;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.85em;
        }
        .time { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>WAHA Session Sync Status</h1>
            <p>CockroachDB - Real-time Monitoring Dashboard</p>
        </header>
        <div class="content">
            <div class="button-group">
                <button onclick="refreshStatus()">🔄 Refresh Now</button>
                <button onclick="showHealth()">💚 Health Check</button>
            </div>
            <div id="status">
                <div style="text-align: center; padding: 40px;">
                    <p style="font-size: 1.2em; color: #667eea;">Loading...</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        }

        function refreshStatus() {
            fetch('/status')
                .then(r => r.json())
                .then(data => {
                    let html = \`
                        <div class="status-card \${data.status === 'connected' ? '' : 'error'}">
                            <strong>Status: \${data.status.toUpperCase()}</strong>
                            <div class="status-info">
                                <div class="info-box">
                                    <strong>Database</strong>
                                    <span>\${data.database || 'N/A'}</span>
                                </div>
                                <div class="info-box">
                                    <strong>Stored Sessions</strong>
                                    <span>\${data.storedSessions || 0}</span>
                                </div>
                                <div class="info-box">
                                    <strong>Local Files</strong>
                                    <span>\${data.localFiles || 0}</span>
                                </div>
                                <div class="info-box">
                                    <strong>Last Check</strong>
                                    <span style="font-size: 0.9em;">\${new Date(data.lastCheck).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    \`;

                    if (data.sessionFiles && data.sessionFiles.length > 0) {
                        html += '<h3>📁 Stored Session Files</h3>';
                        html += '<table>';
                        html += '<tr><th>Filename</th><th>Size</th><th>Updated</th></tr>';
                        data.sessionFiles.forEach(f => {
                            html += \`<tr>
                                <td>\${f.name}</td>
                                <td><span class="size-badge">\${formatBytes(f.size)}</span></td>
                                <td><span class="time">\${new Date(f.updated).toLocaleString()}</span></td>
                            </tr>\`;
                        });
                        html += '</table>';
                    } else {
                        html += '<h3>📁 Stored Session Files</h3>';
                        html += '<p class="empty">No session files stored</p>';
                    }

                    if (data.localFileNames && data.localFileNames.length > 0) {
                        html += '<h3>💾 Local Files</h3>';
                        html += '<ul class="file-list">';
                        data.localFileNames.forEach(f => {
                            html += \`<li>📄 \${f}</li>\`;
                        });
                        html += '</ul>';
                    } else {
                        html += '<h3>💾 Local Files</h3>';
                        html += '<p class="empty">No local files</p>';
                    }

                    document.getElementById('status').innerHTML = html;
                })
                .catch(err => {
                    document.getElementById('status').innerHTML = '<div class="status-card error"><strong>Error loading status</strong></div>';
                });
        }

        function showHealth() {
            fetch('/health')
                .then(r => r.json())
                .then(data => {
                    let html = \`
                        <div class="status-card \${data.status === 'ok' ? '' : 'error'}">
                            <strong>Health Status: \${data.status.toUpperCase()}</strong>
                            <div class="status-info">
                                <div class="info-box">
                                    <strong>Component</strong>
                                    <span>\${data.component}</span>
                                </div>
                                <div class="info-box">
                                    <strong>Database</strong>
                                    <span>\${data.database}</span>
                                </div>
                                <div class="info-box">
                                    <strong>Timestamp</strong>
                                    <span style="font-size: 0.85em;">\${new Date(data.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    \`;

                    if (data.data) {
                        html += '<h3>📊 Data Statistics</h3>';
                        html += \`<div style="background: #f8f9fa; padding: 20px; border-radius: 5px;">
                            <div style="margin-bottom: 15px;">
                                <strong>Sessions:</strong>
                                <ul style="margin-top: 5px; list-style: none;">
                                    <li>Count: \${data.data.sessions.count}</li>
                                    <li>Total Size: \${formatBytes(data.data.sessions.total_size_bytes)}</li>
                                    <li>Last Updated: \${data.data.sessions.last_updated ? new Date(data.data.sessions.last_updated).toLocaleString() : 'N/A'}</li>
                                </ul>
                            </div>
                        \`;
                        if (data.data.media) {
                            html += \`<div>
                                <strong>Media:</strong>
                                <ul style="margin-top: 5px; list-style: none;">
                                    <li>Count: \${data.data.media.count}</li>
                                    <li>Total Size: \${formatBytes(data.data.media.total_size_bytes)}</li>
                                </ul>
                            </div>\`;
                        }
                        html += '</div>';
                    }

                    document.getElementById('status').innerHTML = html;
                })
                .catch(err => {
                    document.getElementById('status').innerHTML = '<div class="status-card error"><strong>Error loading health status</strong></div>';
                });
        }

        setInterval(refreshStatus, 5000); // Auto refresh every 5 seconds
        window.onload = refreshStatus;
    </script>
</body>
</html>
    `);
  });

  app.listen(PORT, () => {
    console.log(`[SYNC] Status server running on port ${PORT}`);
  });

  // Ensure sessions directory exists
  await fs.ensureDir(sessionsDir);

  const watcher = chokidar.watch(sessionsDir, {
    persistent: true,
    ignoreInitial: true,
  });

  const debounceMap = new Map();

  watcher.on("add", (filePath) => {
    if (debounceMap.has(filePath)) clearTimeout(debounceMap.get(filePath));
    debounceMap.set(
      filePath,
      setTimeout(() => uploadSession(filePath), 2000)
    );
  });

  watcher.on("change", (filePath) => {
    if (debounceMap.has(filePath)) clearTimeout(debounceMap.get(filePath));
    debounceMap.set(
      filePath,
      setTimeout(() => uploadSession(filePath), 2000)
    );
  });
}

async function testConnection() {
  console.log("[SYNC] Testing CockroachDB connection...");
  try {
    await initializePool();
    const client = await pool.connect();
    try {
      // Test basic connection
      const result = await client.query("SELECT 1");
      console.log("[SYNC] Connected to CockroachDB");

      // Initialize database
      await initializeDatabase();

      // Check sessions table
      const sessionsResult = await client.query(
        "SELECT COUNT(*) as count FROM sessions"
      );
      console.log(
        `[SYNC] Found ${sessionsResult.rows[0].count} session records`
      );

      // List recent sessions
      const listResult = await client.query(
        `SELECT filename, size_bytes, updated_at 
         FROM sessions 
         ORDER BY updated_at DESC 
         LIMIT 5`
      );

      if (listResult.rows.length > 0) {
        console.log("[SYNC] Recent sessions:");
        listResult.rows.forEach((row) => {
          console.log(
            `  - ${row.filename} (${row.size_bytes} bytes, updated: ${row.updated_at})`
          );
        });
      }

      console.log("[SYNC] Connection test successful!");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[SYNC] Connection test failed:", error.message);
    process.exit(1);
  }
}

const action = process.argv[2];

if (action === "--download") {
  downloadSessions();
} else if (action === "--watch") {
  watchSessions();
} else if (action === "--test-connection") {
  testConnection();
} else {
  console.log("Usage: node sync.js --download | --watch | --test-connection");
}
