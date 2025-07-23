const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const DatabaseManager = require("./database");
const EncryptionManager = require("./encryption");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Initialize managers
const db = new DatabaseManager();
const encryption = new EncryptionManager();

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Store active users and chat rooms
const activeUsers = new Map();
const chatRooms = new Map();

// Default room
const defaultRoom = "general";
chatRooms.set(defaultRoom, new Set());

// Initialize database
async function initializeServer() {
  try {
    await db.initialize();
    console.log("Database initialized successfully");

    // Create default room in database
    await db.createRoom(defaultRoom, "system");
    console.log("Default room created/verified");
  } catch (error) {
    console.error("Failed to initialize server:", error);
    process.exit(1);
  }
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle user joining
  socket.on("join", async (userData) => {
    try {
      const user = {
        id: socket.id,
        username: userData.username || `User${Date.now()}`,
        room: userData.room || defaultRoom,
        joinedAt: new Date(),
      };

      // Generate RSA key pair for the user
      const userKeyPair = encryption.generateUserKeyPair();
      encryption.storeUserKeys(socket.id, userKeyPair);

      // Store user info
      activeUsers.set(socket.id, user);

      // Join the room
      socket.join(user.room);

      // Add user to room tracking
      if (!chatRooms.has(user.room)) {
        chatRooms.set(user.room, new Set());
        await db.createRoom(user.room, user.username);

        // Broadcast new room to all connected users (except default room)
        if (user.room !== "general") {
          io.emit("newRoomCreated", {
            roomName: user.room,
            createdBy: user.username,
          });
        }
      }
      chatRooms.get(user.room).add(socket.id);

      // Store user session in database
      await db.storeUserSession(
        socket.id,
        user.username,
        user.room,
        userKeyPair.publicKey
      );

      // Send user's key pair and room key exchange data
      const roomKeyData = encryption.getRoomKeyExchangeData(
        user.room,
        userKeyPair.publicKey
      );
      socket.emit("keyExchange", {
        userKeys: {
          publicKey: userKeyPair.publicKey,
          privateKey: userKeyPair.privateKey,
        },
        roomKeyData: roomKeyData,
      });

      // Send welcome message to user (not stored in database)
      const welcomeMessage = {
        id: uuidv4(),
        username: "System",
        message: `Welcome to ${user.room} chat room! End-to-end encryption is enabled.`,
        timestamp: new Date(),
        type: "system",
      };

      socket.emit("message", welcomeMessage);

      // Notify others in the room (not stored in database)
      const joinMessage = {
        id: uuidv4(),
        username: "System",
        message: `${user.username} joined the chat`,
        timestamp: new Date(),
        type: "system",
      };

      socket.to(user.room).emit("message", joinMessage);

      // Send updated user list to room
      updateRoomUsers(user.room);

      // Send message history to new user
      const messageHistory = await db.getMessageHistory(user.room, 50);
      socket.emit("messageHistory", messageHistory);
    } catch (error) {
      console.error("Error in user join:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Handle chat messages with encryption
  socket.on("chatMessage", async (messageData) => {
    try {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      const message = {
        id: uuidv4(),
        username: user.username,
        message: messageData.message,
        timestamp: new Date(),
        room: user.room,
        type: "user",
      };

      // Create encrypted message packet
      const encryptedPacket = encryption.createEncryptedMessage(
        { ...message, messageId: message.id },
        user.room,
        socket.id
      );

      // Store encrypted message in database
      await db.storeMessage(
        message.id,
        user.room,
        user.username,
        message,
        "user"
      );

      // Send encrypted message to all users in the room
      io.to(user.room).emit("encryptedMessage", {
        ...message,
        encryptedPacket: encryptedPacket,
      });
    } catch (error) {
      console.error("Error handling chat message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Handle typing indicators
  socket.on("typing", (isTyping) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    socket.to(user.room).emit("userTyping", {
      username: user.username,
      isTyping: isTyping,
    });
  });

  // Handle room switching with encryption
  socket.on("switchRoom", async (newRoom) => {
    try {
      await switchRoom(socket, newRoom);
    } catch (error) {
      console.error("Error switching room:", error);
      socket.emit("error", { message: "Failed to switch room" });
    }
  });

  // Handle user disconnect
  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);

    try {
      const user = activeUsers.get(socket.id);
      if (user) {
        // Remove from room tracking
        chatRooms.get(user.room)?.delete(socket.id);

        // Notify others (not stored in database)
        const leaveMessage = {
          id: uuidv4(),
          username: "System",
          message: `${user.username} left the chat`,
          timestamp: new Date(),
          type: "system",
        };

        socket.to(user.room).emit("message", leaveMessage);

        // Update user list
        updateRoomUsers(user.room);

        // Remove user
        activeUsers.delete(socket.id);

        // Remove user session from database
        await db.removeUserSession(socket.id);

        // Remove encryption keys
        encryption.removeUserKeys(socket.id);
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });

  // Handle room creation with password protection
  socket.on("createRoom", async (roomData) => {
    try {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      const { name, description, isPrivate, password } = roomData;

      // Validate room name
      if (!name || name.length > 20) {
        socket.emit("error", { message: "Invalid room name" });
        return;
      }

      // Create room in database
      await db.createRoom(
        name,
        user.username,
        isPrivate,
        password,
        description
      );

      // Add to local tracking
      if (!chatRooms.has(name)) {
        chatRooms.set(name, new Set());
      }

      // Notify all users about the new room
      io.emit("roomCreated", {
        name: name,
        description: description,
        isPrivate: isPrivate,
        createdBy: user.username,
      });

      // Auto-join the creator to the room
      switchRoom(socket, name, password);

      showNotification(`Room "${name}" created successfully!`, "success");
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // Handle joining private rooms with password
  socket.on("joinPrivateRoom", async (joinData) => {
    try {
      const { roomName, password } = joinData;

      // Verify room and password
      const verification = await db.verifyRoomPassword(roomName, password);

      if (!verification.exists) {
        socket.emit("error", { message: "Room does not exist" });
        return;
      }

      if (!verification.authorized) {
        socket.emit("error", { message: "Incorrect password" });
        return;
      }

      // Join the room
      switchRoom(socket, roomName, password);
    } catch (error) {
      console.error("Error joining private room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  // Helper function to switch rooms
  async function switchRoom(socket, newRoom, password = null) {
    try {
      const user = activeUsers.get(socket.id);
      if (!user) return;

      const oldRoom = user.room;

      // Leave old room
      socket.leave(oldRoom);
      chatRooms.get(oldRoom)?.delete(socket.id);

      // Join new room
      user.room = newRoom;
      socket.join(newRoom);
      if (!chatRooms.has(newRoom)) {
        chatRooms.set(newRoom, new Set());
        await db.createRoom(newRoom, user.username);

        // Broadcast new room to all connected users
        io.emit("newRoomCreated", {
          roomName: newRoom,
          createdBy: user.username,
        });
      }
      chatRooms.get(newRoom).add(socket.id);

      // Update user session in database
      await db.storeUserSession(
        socket.id,
        user.username,
        newRoom,
        encryption.getUserKeys(socket.id)?.publicKey
      );

      // Send new room key exchange data
      const userKeys = encryption.getUserKeys(socket.id);
      if (userKeys) {
        const roomKeyData = encryption.getRoomKeyExchangeData(
          newRoom,
          userKeys.publicKey
        );
        socket.emit("roomKeyExchange", roomKeyData);
      }

      // Update user lists
      updateRoomUsers(oldRoom);
      updateRoomUsers(newRoom);

      // Send room history
      const roomHistory = await db.getMessageHistory(newRoom, 50);
      socket.emit("messageHistory", roomHistory);

      // Notify about room change
      socket.emit("roomChanged", newRoom);
    } catch (error) {
      console.error("Error switching room:", error);
      socket.emit("error", { message: "Failed to switch room" });
    }
  }

  // Function to update room user list
  async function updateRoomUsers(room) {
    try {
      const roomUsers = [];
      const userIds = chatRooms.get(room) || new Set();

      userIds.forEach((userId) => {
        const user = activeUsers.get(userId);
        if (user) {
          roomUsers.push({
            username: user.username,
            joinedAt: user.joinedAt,
          });
        }
      });

      io.to(room).emit("updateUsers", roomUsers);
    } catch (error) {
      console.error("Error updating room users:", error);
    }
  }
});

// API endpoint to get available rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await db.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// API endpoint to get database statistics
app.get("/api/stats", async (req, res) => {
  try {
    const dbStats = await db.getStats();
    const encryptionStats = encryption.getEncryptionStats();

    res.json({
      database: dbStats,
      encryption: encryptionStats,
      server: {
        activeConnections: activeUsers.size,
        totalRooms: chatRooms.size,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Cleanup function for periodic maintenance
function performMaintenance() {
  try {
    // Clean up empty room keys
    const activeRoomNames = Array.from(chatRooms.keys()).filter(
      (room) => chatRooms.get(room).size > 0
    );
    encryption.cleanupEmptyRoomKeys(activeRoomNames);

    console.log("Maintenance completed");
  } catch (error) {
    console.error("Maintenance error:", error);
  }
}

// Run maintenance every hour
setInterval(performMaintenance, 60 * 60 * 1000);

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("\nReceived SIGINT. Graceful shutdown...");

  // Close database connection
  db.close();

  // Close server
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM. Graceful shutdown...");

  // Close database connection
  db.close();

  // Close server
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;

// Initialize server with database
initializeServer()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Secure Chat server running on port ${PORT}`);
      console.log(`📊 Visit http://localhost:${PORT} to access the chat app`);
      console.log(
        `📈 Statistics available at http://localhost:${PORT}/api/stats`
      );
      console.log(`🔐 End-to-end encryption enabled`);
      console.log(`💾 Database storage with compression enabled`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
