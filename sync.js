const { MongoClient, GridFSBucket } = require("mongodb");
const chokidar = require("chokidar");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");

const mongoUrl = process.env.WHATSAPP_SESSIONS_MONGO_URL;
const sessionsDir = "/app/.sessions";

async function connectDB() {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db();
  const bucket = new GridFSBucket(db, { bucketName: "sessions" });
  return { client, bucket };
}

async function downloadSessions() {
  console.log("[SYNC] Starting download phase...");
  try {
    const { client, bucket } = await connectDB();

    // Ensure sessions dir exists
    await fs.ensureDir(sessionsDir);

    // Get all files from GridFS
    const files = await bucket.find({}).toArray();

    for (const file of files) {
      const filePath = path.join(sessionsDir, file.filename);
      console.log(`[SYNC] Downloading ${file.filename}...`);
      const downloadStream = bucket.openDownloadStream(file._id);
      const writeStream = fs.createWriteStream(filePath);
      downloadStream.pipe(writeStream);

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });
    }

    await client.close();
    console.log("[SYNC] Download phase completed.");
  } catch (error) {
    console.error("[SYNC] Error during download:", error);
  }
}

async function uploadSession(filePath) {
  const filename = path.basename(filePath);
  console.log(`[SYNC] Uploading ${filename}...`);
  try {
    const { client, bucket } = await connectDB();

    // Delete existing file if any
    const existingFiles = await bucket.find({ filename }).toArray();
    for (const file of existingFiles) {
      await bucket.delete(file._id);
    }

    // Upload new file
    const uploadStream = bucket.openUploadStream(filename);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(uploadStream);

    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);
    });

    await client.close();
    console.log(`[SYNC] Uploaded ${filename}.`);
  } catch (error) {
    console.error(`[SYNC] Error uploading ${filename}:`, error);
  }
}

async function watchSessions() {
  console.log("[SYNC] Starting watch mode...");

  // Start status server
  const app = express();
  const PORT = 3001; // Different port from WAHA's 3000

  app.get("/status", async (req, res) => {
    try {
      const { client, bucket } = await connectDB();
      const db = client.db();
      const files = await bucket.find({}).toArray();
      await client.close();

      const localFiles = await fs.readdir(sessionsDir).catch(() => []);

      res.json({
        status: "connected",
        database: db.databaseName,
        storedSessions: files.length,
        sessionFiles: files.map((f) => ({
          name: f.filename,
          size: f.length,
          uploaded: f.uploadDate,
        })),
        localFiles: localFiles.length,
        localFileNames: localFiles,
        lastCheck: new Date().toISOString(),
      });
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
    <title>WAHA Sync Status</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .refresh { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        .refresh:hover { background: #0056b3; }
    </style>
    <script>
        function refreshStatus() {
            fetch('/status')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('status').innerHTML = \`
                        <div class="status \${data.status === 'connected' ? 'connected' : 'error'}">
                            <strong>Status:</strong> \${data.status.toUpperCase()}<br>
                            <strong>Database:</strong> \${data.database || 'N/A'}<br>
                            <strong>Stored Sessions:</strong> \${data.storedSessions || 0}<br>
                            <strong>Local Files:</strong> \${data.localFiles || 0}<br>
                            <strong>Last Check:</strong> \${data.lastCheck}
                        </div>
                        <h3>Stored Session Files</h3>
                        <table>
                            <tr><th>Filename</th><th>Size (bytes)</th><th>Uploaded</th></tr>
                            \${data.sessionFiles && data.sessionFiles.length > 0 ?
                                data.sessionFiles.map(f => \`<tr><td>\${f.name}</td><td>\${f.size}</td><td>\${f.uploaded}</td></tr>\`).join('') :
                                '<tr><td colspan="3">No session files stored</td></tr>'}
                        </table>
                        <h3>Local Files</h3>
                        <ul>
                            \${data.localFileNames && data.localFileNames.length > 0 ?
                                data.localFileNames.map(f => \`<li>\${f}</li>\`).join('') :
                                '<li>No local files</li>'}
                        </ul>
                    \`;
                })
                .catch(err => {
                    document.getElementById('status').innerHTML = '<div class="status error">Error loading status</div>';
                });
        }
        setInterval(refreshStatus, 5000); // Auto refresh every 5 seconds
        window.onload = refreshStatus;
    </script>
</head>
<body>
    <h1>WAHA Session Sync Status</h1>
    <button class="refresh" onclick="refreshStatus()">Refresh Now</button>
    <div id="status">Loading...</div>
</body>
</html>
    `);
  });

  app.listen(PORT, () => {
    console.log(`[SYNC] Status server running on port ${PORT}`);
  });

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
  console.log("[SYNC] Testing MongoDB connection...");
  try {
    const { client, bucket } = await connectDB();

    // Test basic connection
    const db = client.db();
    const collections = await db.collections();
    console.log(`[SYNC] Connected to database: ${db.databaseName}`);

    // Check GridFS bucket
    const files = await bucket.find({}).toArray();
    console.log(`[SYNC] Found ${files.length} session files in GridFS`);

    // List file names
    if (files.length > 0) {
      console.log("[SYNC] Session files:");
      files.forEach((file) => {
        console.log(
          `  - ${file.filename} (${file.length} bytes, uploaded: ${file.uploadDate})`
        );
      });
    }

    await client.close();
    console.log("[SYNC] Connection test successful!");
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
