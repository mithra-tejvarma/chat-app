const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib"); // Built-in Node.js module

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, "chat.db");
    this.db = null;
    this.encryptionKey =
      process.env.DB_ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  // Generate a consistent encryption key for database
  generateEncryptionKey() {
    // In production, this should be stored securely
    return crypto.scryptSync("chat-app-secret", "salt", 32);
  }

  // Hash password for room protection
  hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  // Verify password
  verifyPassword(password, hash) {
    return this.hashPassword(password) === hash;
  }

  // Initialize database connection and create tables
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error("Error opening database:", err);
          reject(err);
        } else {
          console.log("Connected to SQLite database");
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Create necessary tables (preserve existing data)
  async createTables() {
    const createTablesSQL = `
            -- Create tables only if they don't exist (preserve existing data)
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                public_key TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Rooms table with password protection
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                is_private BOOLEAN DEFAULT 0,
                password_hash TEXT,
                description TEXT
            );

            -- Messages table with encryption and compression
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE NOT NULL,
                room_name TEXT NOT NULL,
                username TEXT NOT NULL,
                encrypted_content BLOB NOT NULL,
                message_type TEXT DEFAULT 'user',
                compressed_size INTEGER,
                original_size INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_name) REFERENCES rooms (name)
            );

            -- User sessions for key management
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                socket_id TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                room_name TEXT NOT NULL,
                public_key TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_name);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_sessions_socket ON user_sessions(socket_id);
        `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error("Error creating tables:", err);
          reject(err);
        } else {
          console.log("Database tables created successfully");
          this.ensureDefaultData().then(resolve).catch(reject);
        }
      });
    });
  }

  // Ensure default data exists (only insert if not already present)
  async ensureDefaultData() {
    return new Promise((resolve, reject) => {
      // Clear user sessions on startup (socket sessions should be fresh)
      const clearSessions = `DELETE FROM user_sessions`;

      this.db.run(clearSessions, (err) => {
        if (err) {
          console.error("Error clearing user sessions:", err);
          reject(err);
        } else {
          // Remove any existing system messages (join/leave/welcome messages)
          const removeSystemMessages = `DELETE FROM messages WHERE message_type = 'system'`;

          this.db.run(removeSystemMessages, (err) => {
            if (err) {
              console.error("Error removing system messages:", err);
              reject(err);
            } else {
              // Ensure default room exists
              const insertDefaultRoom = `
                                INSERT OR IGNORE INTO rooms (name, created_by, is_private, description) 
                                VALUES ('general', 'system', 0, 'Main public chat room for everyone')
                            `;

              this.db.run(insertDefaultRoom, (err) => {
                if (err) {
                  console.error("Error ensuring default data:", err);
                  reject(err);
                } else {
                  console.log(
                    "Database initialized - user messages preserved, system messages and sessions cleared"
                  );
                  resolve();
                }
              });
            }
          });
        }
      });
    });
  }

  // Encrypt and compress message content with maximum efficiency Brotli compression
  encryptAndCompressMessage(content) {
    try {
      const originalData = JSON.stringify(content);
      const originalBuffer = Buffer.from(originalData);

      // Use Brotli compression with maximum settings for optimal storage efficiency
      // Brotli provides 15-25% better compression than gzip and is built into Node.js
      const brotliCompressed = zlib.brotliCompressSync(originalBuffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_QUALITY]:
            zlib.constants.BROTLI_MAX_QUALITY, // Maximum compression (11)
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: originalBuffer.length,
          [zlib.constants.BROTLI_PARAM_LGWIN]:
            zlib.constants.BROTLI_MAX_WINDOW_BITS, // Maximum window size (24)
          [zlib.constants.BROTLI_PARAM_LGBLOCK]: 0, // Auto-select block size
        },
      });

      // For very small messages, try additional dictionary-based optimization
      let finalCompressed = brotliCompressed;
      if (originalBuffer.length < 1000) {
        // For small chat messages, create a simple frequency-based optimization
        const optimizedData = this.optimizeSmallMessage(originalData);
        const optimizedBuffer = Buffer.from(optimizedData);
        const optimizedBrotli = zlib.brotliCompressSync(optimizedBuffer, {
          params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]:
              zlib.constants.BROTLI_MAX_QUALITY,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: optimizedBuffer.length,
            [zlib.constants.BROTLI_PARAM_LGWIN]:
              zlib.constants.BROTLI_MAX_WINDOW_BITS,
          },
        });

        // Use the smaller result
        if (optimizedBrotli.length < brotliCompressed.length) {
          finalCompressed = optimizedBrotli;
        }
      }

      // Then encrypt the compressed data
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher("aes-256-gcm", this.encryptionKey);
      cipher.setAAD(Buffer.from("chat-message"));

      let encrypted = Buffer.concat([
        cipher.update(finalCompressed),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      const result = Buffer.concat([iv, authTag, encrypted]);

      const compressionRatio =
        ((originalBuffer.length - finalCompressed.length) /
          originalBuffer.length) *
        100;

      // Log compression statistics for monitoring
      if (originalBuffer.length > 0) {
        console.log(
          `Compression: ${originalBuffer.length}B → ${
            finalCompressed.length
          }B (${compressionRatio.toFixed(1)}% saved)`
        );
      }

      return {
        encryptedData: result,
        originalSize: originalBuffer.length,
        compressedSize: finalCompressed.length,
        compressionRatio: compressionRatio.toFixed(1),
      };
    } catch (error) {
      console.error("Encryption error:", error);
      throw error;
    }
  }

  // Optimize small messages with frequency-based compression helper
  optimizeSmallMessage(data) {
    // Simple optimization for common chat patterns
    const commonReplacements = {
      '"message":"': '"m":"',
      '"username":"': '"u":"',
      '"timestamp":"': '"t":"',
      '"type":"': '"y":"',
      '"room":"': '"r":"',
      " ": "~", // Replace spaces with shorter character
      "the ": "T",
      "and ": "A",
      "you ": "Y",
      "that ": "H",
      "this ": "S",
    };

    let optimized = data;
    for (const [pattern, replacement] of Object.entries(commonReplacements)) {
      optimized = optimized.split(pattern).join(replacement);
    }

    return optimized;
  }

  // Reverse the optimization for small messages
  unoptimizeSmallMessage(data) {
    const reverseReplacements = {
      '"m":"': '"message":"',
      '"u":"': '"username":"',
      '"t":"': '"timestamp":"',
      '"y":"': '"type":"',
      '"r":"': '"room":"',
      "~": " ", // Restore spaces
      T: "the ",
      A: "and ",
      Y: "you ",
      H: "that ",
      S: "this ",
    };

    let unoptimized = data;
    for (const [pattern, replacement] of Object.entries(reverseReplacements)) {
      unoptimized = unoptimized.split(pattern).join(replacement);
    }

    return unoptimized;
  }

  // Decrypt and decompress message content with Brotli decompression
  decryptAndDecompressMessage(encryptedData) {
    try {
      // Extract IV, auth tag, and encrypted data
      const iv = encryptedData.slice(0, 16);
      const authTag = encryptedData.slice(16, 32);
      const encrypted = encryptedData.slice(32);

      // Decrypt
      const decipher = crypto.createDecipher("aes-256-gcm", this.encryptionKey);
      decipher.setAAD(Buffer.from("chat-message"));
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      // Decompress using Brotli
      const decompressed = zlib.brotliDecompressSync(decrypted);

      let finalData = decompressed.toString();

      // Try to unoptimize if it looks like an optimized small message
      if (finalData.includes('"m":"') || finalData.includes("~")) {
        try {
          const unoptimized = this.unoptimizeSmallMessage(finalData);
          // Validate that it's valid JSON after unoptimization
          JSON.parse(unoptimized);
          finalData = unoptimized;
        } catch (e) {
          // If unoptimization fails, use the original data
        }
      }

      return JSON.parse(finalData);
    } catch (error) {
      console.error("Decryption error:", error);
      throw error;
    }
  }

  // Store user session
  async storeUserSession(socketId, username, roomName, publicKey = null) {
    return new Promise((resolve, reject) => {
      const sql = `
                INSERT OR REPLACE INTO user_sessions 
                (socket_id, username, room_name, public_key) 
                VALUES (?, ?, ?, ?)
            `;

      this.db.run(
        sql,
        [socketId, username, roomName, publicKey],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // Remove user session
  async removeUserSession(socketId) {
    return new Promise((resolve, reject) => {
      const sql = "DELETE FROM user_sessions WHERE socket_id = ?";

      this.db.run(sql, [socketId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Store message in database
  async storeMessage(
    messageId,
    roomName,
    username,
    content,
    messageType = "user"
  ) {
    try {
      const { encryptedData, originalSize, compressedSize } =
        this.encryptAndCompressMessage(content);

      return new Promise((resolve, reject) => {
        const sql = `
                    INSERT INTO messages 
                    (message_id, room_name, username, encrypted_content, message_type, compressed_size, original_size) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

        this.db.run(
          sql,
          [
            messageId,
            roomName,
            username,
            encryptedData,
            messageType,
            compressedSize,
            originalSize,
          ],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.lastID);
            }
          }
        );
      });
    } catch (error) {
      throw new Error(`Failed to store message: ${error.message}`);
    }
  }

  // Retrieve message history for a room (only user messages, not system messages)
  async getMessageHistory(roomName, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT message_id, username, encrypted_content, message_type, created_at, 
                       compressed_size, original_size
                FROM messages 
                WHERE room_name = ? AND message_type = 'user'
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;

      this.db.all(sql, [roomName, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          try {
            const messages = rows
              .map((row) => {
                const decryptedContent = this.decryptAndDecompressMessage(
                  row.encrypted_content
                );
                return {
                  id: row.message_id,
                  username: row.username,
                  message: decryptedContent.message,
                  timestamp: row.created_at,
                  type: row.message_type,
                  room: roomName,
                  compressionRatio: (
                    ((row.original_size - row.compressed_size) /
                      row.original_size) *
                    100
                  ).toFixed(1),
                };
              })
              .reverse(); // Reverse to show oldest first

            resolve(messages);
          } catch (error) {
            console.error("Error decrypting messages:", error);
            resolve([]); // Return empty array if decryption fails
          }
        }
      });
    });
  }

  // Create or get room with password protection
  async createRoom(
    roomName,
    createdBy = "system",
    isPrivate = false,
    password = null,
    description = ""
  ) {
    return new Promise((resolve, reject) => {
      const passwordHash =
        isPrivate && password ? this.hashPassword(password) : null;
      const sql = `
                INSERT OR IGNORE INTO rooms (name, created_by, is_private, password_hash, description) 
                VALUES (?, ?, ?, ?, ?)
            `;

      this.db.run(
        sql,
        [roomName, createdBy, isPrivate ? 1 : 0, passwordHash, description],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID || "exists");
          }
        }
      );
    });
  }

  // Verify room password
  async verifyRoomPassword(roomName, password) {
    return new Promise((resolve, reject) => {
      const sql = "SELECT password_hash, is_private FROM rooms WHERE name = ?";

      this.db.get(sql, [roomName], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve({ exists: false });
        } else if (!row.is_private) {
          resolve({ exists: true, authorized: true, isPrivate: false });
        } else {
          const authorized = password
            ? this.verifyPassword(password, row.password_hash)
            : false;
          resolve({ exists: true, authorized, isPrivate: true });
        }
      });
    });
  }

  // Get all rooms with privacy information
  async getAllRooms() {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT name, created_at, created_by, is_private, description 
                FROM rooms 
                ORDER BY created_at ASC
            `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(
            rows.map((row) => ({
              name: row.name,
              createdAt: row.created_at,
              createdBy: row.created_by,
              isPrivate: Boolean(row.is_private),
              description: row.description,
            }))
          );
        }
      });
    });
  }

  // Get users in a room
  async getUsersInRoom(roomName) {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT username, public_key, created_at 
                FROM user_sessions 
                WHERE room_name = ? 
                ORDER BY created_at ASC
            `;

      this.db.all(sql, [roomName], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get database statistics with enhanced compression metrics (only user messages)
  async getStats() {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM messages WHERE message_type = 'user') as total_messages,
                    (SELECT COUNT(*) FROM rooms) as total_rooms,
                    (SELECT COUNT(*) FROM user_sessions) as active_users,
                    (SELECT AVG(compressed_size * 100.0 / original_size) FROM messages WHERE original_size > 0 AND message_type = 'user') as avg_compression_ratio,
                    (SELECT SUM(compressed_size) FROM messages WHERE message_type = 'user') as total_storage_used,
                    (SELECT SUM(original_size) FROM messages WHERE message_type = 'user') as total_original_size,
                    (SELECT MIN(compressed_size * 100.0 / original_size) FROM messages WHERE original_size > 0 AND message_type = 'user') as best_compression_ratio,
                    (SELECT MAX(compressed_size * 100.0 / original_size) FROM messages WHERE original_size > 0 AND message_type = 'user') as worst_compression_ratio,
                    (SELECT AVG(original_size) FROM messages WHERE original_size > 0 AND message_type = 'user') as avg_message_size
            `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const totalOriginal = row.total_original_size || 0;
          const totalCompressed = row.total_storage_used || 0;
          const spaceSavedBytes = totalOriginal - totalCompressed;
          const spaceSavedPercent = totalOriginal
            ? ((spaceSavedBytes / totalOriginal) * 100).toFixed(1)
            : "0.0";

          resolve({
            totalMessages: row.total_messages || 0,
            totalRooms: row.total_rooms || 0,
            activeUsers: row.active_users || 0,
            avgCompressionRatio: row.avg_compression_ratio
              ? (100 - row.avg_compression_ratio).toFixed(1)
              : "0.0",
            bestCompressionRatio: row.best_compression_ratio
              ? (100 - row.best_compression_ratio).toFixed(1)
              : "0.0",
            worstCompressionRatio: row.worst_compression_ratio
              ? (100 - row.worst_compression_ratio).toFixed(1)
              : "0.0",
            avgMessageSize: Math.round(row.avg_message_size || 0),
            totalStorageUsed: totalCompressed,
            totalOriginalSize: totalOriginal,
            spaceSaved: spaceSavedPercent,
            spaceSavedBytes: spaceSavedBytes,
            compressionEfficiency: totalOriginal
              ? ((spaceSavedBytes / totalOriginal) * 100).toFixed(2)
              : "0.00",
          });
        }
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
        } else {
          console.log("Database connection closed");
        }
      });
    }
  }
}

module.exports = DatabaseManager;
