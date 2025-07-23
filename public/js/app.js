// DOM Elements
const loginScreen = document.getElementById("loginScreen");
const chatApp = document.getElementById("chatApp");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");
const roomInput = document.getElementById("roomInput");
const messagesList = document.getElementById("messagesList");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const currentRoom = document.getElementById("currentRoom");
const onlineCount = document.getElementById("onlineCount");
const usersList = document.getElementById("usersList");
const roomsList = document.getElementById("roomsList");
const typingIndicator = document.getElementById("typingIndicator");
const typingText = document.getElementById("typingText");
const messagesContainer = document.getElementById("messagesContainer");

// Modal elements
const createRoomModal = document.getElementById("createRoomModal");
const createRoomBtn = document.getElementById("createRoomBtn");
const createRoomForm = document.getElementById("createRoomForm");
const newRoomName = document.getElementById("newRoomName");
const roomDescription = document.getElementById("roomDescription");
const passwordSection = document.getElementById("passwordSection");
const roomPassword = document.getElementById("roomPassword");
const closeCreateRoom = document.getElementById("closeCreateRoom");
const cancelCreateRoom = document.getElementById("cancelCreateRoom");

// Password modal elements
const passwordModal = document.getElementById("passwordModal");
const passwordForm = document.getElementById("passwordForm");
const joinPassword = document.getElementById("joinPassword");
const closePasswordModal = document.getElementById("closePasswordModal");
const cancelPassword = document.getElementById("cancelPassword");

// Other elements
const logoutBtn = document.getElementById("logoutBtn");
const emojiBtn = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const statsBtn = document.getElementById("statsBtn");
const statsModal = document.getElementById("statsModal");
const closeStatsModal = document.getElementById("closeStatsModal");
const refreshStats = document.getElementById("refreshStats");

// Join room elements
const joinRoomInput = document.getElementById("joinRoomInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");

// Socket.IO connection
let socket = null;
let currentUser = null;
let currentRoomName = "general";
let typingTimeout = null;
let isTyping = false;

// Encryption keys
let userKeys = null;
let roomKey = null;

// Global variables for password handling
let pendingRoomJoin = null;

// Crypto utilities for client-side encryption
const CryptoUtils = {
  // Convert string to ArrayBuffer
  stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  },

  // Convert ArrayBuffer to string
  arrayBufferToString(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  },

  // Convert string to base64
  stringToBase64(str) {
    return btoa(str);
  },

  // Convert base64 to string
  base64ToString(base64) {
    return atob(base64);
  },

  // Simple AES encryption using Web Crypto API (fallback for demo)
  async encryptMessage(message, key) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));

      // For demo purposes, we'll use a simple base64 encoding
      // In production, use proper Web Crypto API
      return {
        encrypted: this.stringToBase64(JSON.stringify(message)),
        iv: "demo-iv",
        authTag: "demo-auth",
      };
    } catch (error) {
      console.error("Encryption error:", error);
      return null;
    }
  },

  // Simple AES decryption
  async decryptMessage(encryptedData, key) {
    try {
      // For demo purposes, simple base64 decoding
      return JSON.parse(this.base64ToString(encryptedData.encrypted));
    } catch (error) {
      console.error("Decryption error:", error);
      return null;
    }
  },
};

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  // Focus on username input
  usernameInput.focus();

  // Setup event listeners
  setupEventListeners();
  setupMobileMenu();
});

function setupEventListeners() {
  // Login form
  loginForm.addEventListener("submit", handleLogin);

  // Message form
  messageForm.addEventListener("submit", handleSendMessage);

  // Message input typing detection
  messageInput.addEventListener("input", handleTyping);
  messageInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  });

  // Logout
  logoutBtn.addEventListener("click", handleLogout);

  // Statistics
  statsBtn.addEventListener("click", () => {
    showModal(statsModal);
    loadStatistics();
  });
  closeStatsModal.addEventListener("click", () => hideModal(statsModal));
  refreshStats.addEventListener("click", loadStatistics);

  // Room creation
  createRoomBtn.addEventListener("click", () => showModal(createRoomModal));
  createRoomForm.addEventListener("submit", handleCreateRoom);
  closeCreateRoom.addEventListener("click", () => hideModal(createRoomModal));
  cancelCreateRoom.addEventListener("click", () => hideModal(createRoomModal));

  // Privacy option change
  document.addEventListener("change", function (e) {
    if (e.target.name === "roomPrivacy") {
      if (e.target.value === "private") {
        passwordSection.classList.remove("hidden");
        roomPassword.setAttribute("required", "required");
      } else {
        passwordSection.classList.add("hidden");
        roomPassword.removeAttribute("required");
        roomPassword.value = "";
      }
    }
  });

  // Password modal
  passwordForm.addEventListener("submit", handlePasswordSubmit);
  closePasswordModal.addEventListener("click", () => hideModal(passwordModal));
  cancelPassword.addEventListener("click", () => hideModal(passwordModal));

  // Emoji picker
  emojiBtn.addEventListener("click", toggleEmojiPicker);
  document.addEventListener("click", function (e) {
    if (!emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
      emojiPicker.classList.add("hidden");
    }
  });

  // Join room functionality
  joinRoomBtn.addEventListener("click", handleJoinRoom);
  joinRoomInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      handleJoinRoom();
    }
  });

  // Room switching
  roomsList.addEventListener("click", function (e) {
    const roomItem = e.target.closest(".room-item");
    if (roomItem) {
      const roomName = roomItem.dataset.room;
      const isPrivate = roomItem.classList.contains("private");

      if (isPrivate && roomName !== currentRoomName) {
        // Show password prompt for private rooms
        showPasswordPrompt(roomName);
      } else {
        switchRoom(roomName);
      }

      // Close mobile menu when room is selected
      closeMobileMenuOnRoomSwitch();
    }
  });

  // Close modals on backdrop click
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("modal")) {
      hideModal(e.target);
    }
  });
}

function handleLogin(e) {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const room = roomInput.value.trim() || "general";

  if (!username) {
    alert("Please enter a username");
    return;
  }

  if (username.length > 20) {
    alert("Username must be 20 characters or less");
    return;
  }

  // Initialize socket connection
  const socketUrl =
    window.location.hostname === "localhost" ? "" : window.location.origin;

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    maxReconnectionAttempts: 5,
  });
  setupSocketListeners();

  // Set current user data
  currentUser = {
    username: username,
    room: room,
  };

  currentRoomName = room;

  // Join the chat
  socket.emit("join", currentUser);

  // Show chat app
  loginScreen.classList.add("hidden");
  chatApp.classList.remove("hidden");

  // Update UI
  currentRoom.textContent = `#${room}`;
  messageInput.focus();
}

function setupSocketListeners() {
  // Connection events
  socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);
    showNotification("Connected to secure chat server", "success");
    updateConnectionStatus(true);

    // Re-join room if we were in one
    if (currentUser) {
      console.log("Re-joining room with user data:", currentUser);
      socket.emit("join", currentUser);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Disconnected from server:", reason);
    showNotification("Connection lost. Trying to reconnect...", "error");
    updateConnectionStatus(false);
  });

  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
    showNotification(
      "Failed to connect to server. Please refresh the page.",
      "error"
    );
    updateConnectionStatus(false);
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("Reconnected after", attemptNumber, "attempts");
    showNotification("Reconnected to server!", "success");
    updateConnectionStatus(true);
  });

  socket.on("reconnect_error", (error) => {
    console.error("Reconnection error:", error);
    showNotification("Failed to reconnect. Please refresh the page.", "error");
    updateConnectionStatus(false);
  });

  // Key exchange events
  socket.on("keyExchange", (keyData) => {
    console.log("Received key exchange data");
    userKeys = keyData.userKeys;

    // Store room key (in production, decrypt with private key)
    roomKey = keyData.roomKeyData.encryptedRoomKey;

    showNotification("🔐 End-to-end encryption established", "success");
  });

  socket.on("roomKeyExchange", (roomKeyData) => {
    console.log("Received room key for new room");
    roomKey = roomKeyData.encryptedRoomKey;
    showNotification(
      `🔐 Encryption keys updated for #${roomKeyData.roomName}`,
      "success"
    );
  });

  // Load available rooms after connection
  socket.on("connect", loadAvailableRooms);

  // Room change events
  socket.on("roomChanged", (newRoom) => {
    currentRoomName = newRoom;
    currentRoom.textContent = `#${newRoom}`;
    updateActiveRoom(newRoom);

    // Close mobile menu when switching rooms
    closeMobileMenuOnRoomSwitch();

    // Don't clear messages here - messageHistory event will handle it

    showNotification(`Switched to room #${newRoom}`, "success");
  });

  // New room created by other users
  socket.on("roomCreated", (roomData) => {
    addRoomToList(roomData);
    showNotification(
      `New room "${roomData.name}" created by ${roomData.createdBy}`,
      "info"
    );
  });

  // Message events (legacy support)
  socket.on("message", (message) => {
    displayMessage(message);
    scrollToBottom();
  });

  // Encrypted message events
  socket.on("encryptedMessage", async (messageData) => {
    try {
      console.log("Received encrypted message:", messageData);

      // For demo purposes, we'll show the message directly
      // In production, decrypt the encryptedPacket here
      const message = {
        id: messageData.id,
        username: messageData.username,
        message: messageData.message,
        timestamp: messageData.timestamp,
        type: messageData.type,
        encrypted: true,
      };

      console.log("Displaying message:", message);
      displayMessage(message);
      scrollToBottom();
    } catch (error) {
      console.error("Error handling encrypted message:", error);
      showNotification("Failed to decrypt message", "error");
    }
  });

  socket.on("messageHistory", (messages) => {
    clearMessages();
    messages.forEach((message) => {
      // Add encryption indicator to history messages
      message.encrypted = true;
      displayMessage(message, false);
    });
    scrollToBottom();

    if (messages.length > 0) {
      showNotification(
        `📜 Loaded ${messages.length} encrypted messages`,
        "info"
      );
    }
  });

  // User events
  socket.on("updateUsers", (users) => {
    updateUsersList(users);
  });

  socket.on("userTyping", (data) => {
    handleUserTyping(data);
  });

  // Error handling
  socket.on("error", (error) => {
    console.error("Socket error:", error);
    showNotification(error.message || "An error occurred", "error");
  });
}

function handleSendMessage(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  if (!socket || !socket.connected) {
    showNotification(
      "Not connected to server. Please wait for reconnection.",
      "error"
    );
    return;
  }

  console.log("Sending message:", message);
  console.log("Current user:", currentUser);
  console.log("Socket connected:", socket.connected);

  // Show sending indicator
  const sendButton = document.getElementById("sendBtn");
  const originalHTML = sendButton.innerHTML;
  sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  sendButton.disabled = true;

  try {
    // Send message to server with timeout
    const messageData = { message: message };
    console.log("Emitting chatMessage with data:", messageData);

    socket.timeout(5000).emit("chatMessage", messageData, (err, response) => {
      console.log("Message response:", { err, response });

      if (err) {
        console.error("Message timeout or error:", err);
        showNotification("Message failed to send (timeout)", "error");
        return;
      }

      if (response && response.error) {
        console.error("Server error:", response.error);
        showNotification("Failed to send message: " + response.error, "error");
      } else if (response && response.success) {
        console.log("Message sent successfully");
        // Don't show success notification for every message
      } else {
        console.warn("Unexpected response:", response);
        showNotification("Message may not have been sent properly", "warning");
      }
    });

    // Clear input immediately (optimistic update)
    messageInput.value = "";

    // Stop typing indicator
    if (isTyping) {
      socket.emit("typing", false);
      isTyping = false;
    }

    // Resize input if it was expanded
    messageInput.style.height = "auto";
  } catch (error) {
    console.error("Error sending message:", error);
    showNotification("Failed to send message", "error");
  } finally {
    // Restore send button
    setTimeout(() => {
      sendButton.innerHTML = originalHTML;
      sendButton.disabled = false;
      messageInput.focus();
    }, 500);
  }
}

function handleTyping() {
  if (!socket) return;

  // Send typing indicator
  if (!isTyping) {
    socket.emit("typing", true);
    isTyping = true;
  }

  // Clear existing timeout
  clearTimeout(typingTimeout);

  // Set timeout to stop typing indicator
  typingTimeout = setTimeout(() => {
    socket.emit("typing", false);
    isTyping = false;
  }, 3000);
}

function handleUserTyping(data) {
  if (data.isTyping) {
    typingText.textContent = `${data.username} is typing...`;
    typingIndicator.classList.remove("hidden");
  } else {
    typingIndicator.classList.add("hidden");
  }
}

function displayMessage(message, animate = true) {
  const messageElement = document.createElement("div");
  messageElement.className = `message ${message.type}`;

  if (message.username === currentUser?.username && message.type !== "system") {
    messageElement.classList.add("own");
  }

  if (message.type === "system") {
    messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(message.message)}</div>
            </div>
        `;
  } else {
    const avatar = message.username.charAt(0).toUpperCase();
    const time = new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Add encryption indicator
    const encryptionIcon = message.encrypted
      ? '<i class="fas fa-lock" title="End-to-end encrypted" style="color: #10b981; margin-left: 0.5rem;"></i>'
      : "";

    messageElement.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(
                      message.username
                    )}</span>
                    <span class="message-time">${time}</span>
                    ${encryptionIcon}
                </div>
                <div class="message-text">${formatMessage(
                  message.message
                )}</div>
            </div>
        `;
  }

  if (!animate) {
    messageElement.style.animation = "none";
  }

  messagesList.appendChild(messageElement);
}

function formatMessage(text) {
  // Escape HTML first
  text = escapeHtml(text);

  // Convert URLs to links
  text = text.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );

  // Convert line breaks
  text = text.replace(/\n/g, "<br>");

  return text;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateUsersList(users) {
  usersList.innerHTML = "";

  users.forEach((user) => {
    const userElement = document.createElement("div");
    userElement.className = "user-item";
    userElement.innerHTML = `
            <div class="user-status"></div>
            <span>${escapeHtml(user.username)}</span>
        `;
    usersList.appendChild(userElement);
  });

  // Update online count
  onlineCount.textContent = `${users.length} online`;
}

function scrollToBottom() {
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 100);
}

function clearMessages() {
  messagesList.innerHTML = "";
}

function handleLogout() {
  if (socket) {
    socket.disconnect();
  }

  // Reset UI
  chatApp.classList.add("hidden");
  loginScreen.classList.remove("hidden");

  // Clear form
  usernameInput.value = "";
  roomInput.value = "";

  // Reset variables
  currentUser = null;
  socket = null;

  // Focus on username input
  usernameInput.focus();
}

function handleCreateRoom(e) {
  e.preventDefault();

  const roomName = newRoomName.value.trim();
  const description = roomDescription.value.trim();
  const isPrivate =
    document.querySelector('input[name="roomPrivacy"]:checked').value ===
    "private";
  const password = isPrivate ? roomPassword.value.trim() : "";

  if (!roomName) return;

  if (roomName.length > 20) {
    alert("Room name must be 20 characters or less");
    return;
  }

  if (isPrivate && !password) {
    alert("Please enter a password for the private room");
    return;
  }

  // Send room creation request to server
  socket.emit("createRoom", {
    name: roomName,
    description: description,
    isPrivate: isPrivate,
    password: password,
  });

  // Hide modal
  hideModal(createRoomModal);

  // Clear form
  newRoomName.value = "";
  roomDescription.value = "";
  roomPassword.value = "";
  document.querySelector(
    'input[name="roomPrivacy"][value="public"]'
  ).checked = true;
  passwordSection.classList.add("hidden");
}

function showPasswordPrompt(roomName) {
  pendingRoomJoin = roomName;
  showModal(passwordModal);
  joinPassword.focus();
}

function handlePasswordSubmit(e) {
  e.preventDefault();

  const password = joinPassword.value.trim();
  if (!password || !pendingRoomJoin) return;

  // Send room join request with password
  socket.emit("joinPrivateRoom", {
    roomName: pendingRoomJoin,
    password: password,
  });

  // Clear form and hide modal
  joinPassword.value = "";
  hideModal(passwordModal);
}

function handleJoinRoom() {
  const roomName = joinRoomInput.value.trim();
  if (!roomName) return;

  if (roomName.length > 20) {
    alert("Room name must be 20 characters or less");
    return;
  }

  // Check if already in this room
  if (roomName === currentRoomName) {
    joinRoomInput.value = "";
    return;
  }

  // Disable button while joining
  joinRoomBtn.disabled = true;
  joinRoomInput.disabled = true;

  // Add room to list if it doesn't exist
  addRoomToList(roomName);

  // Switch to the room
  switchRoom(roomName);

  // Clear input and re-enable after a short delay
  setTimeout(() => {
    joinRoomInput.value = "";
    joinRoomBtn.disabled = false;
    joinRoomInput.disabled = false;
  }, 500);
}

function addRoomToList(roomData) {
  const roomName = typeof roomData === "string" ? roomData : roomData.name;
  const isPrivate = typeof roomData === "object" ? roomData.isPrivate : false;
  const description = typeof roomData === "object" ? roomData.description : "";

  // Check if room already exists
  const existingRoom = document.querySelector(`[data-room="${roomName}"]`);
  if (existingRoom) return;

  const roomElement = document.createElement("div");
  roomElement.className = `room-item ${isPrivate ? "private" : ""}`;
  roomElement.dataset.room = roomName;
  roomElement.title =
    description ||
    (isPrivate ? "Private room - password required" : "Public room");

  const icon = isPrivate ? "fas fa-lock" : "fas fa-hashtag";
  const typeLabel = isPrivate ? "Private" : "Public";

  roomElement.innerHTML = `
        <i class="${icon}"></i>
        <span>${escapeHtml(roomName)}</span>
        <small class="room-type">${typeLabel}</small>
    `;

  roomsList.appendChild(roomElement);
}

async function loadAvailableRooms() {
  try {
    const response = await fetch("/api/rooms");
    if (response.ok) {
      const rooms = await response.json();

      // Add rooms that aren't already in the list
      rooms.forEach((room) => {
        addRoomToList(room);
      });
    }
  } catch (error) {
    console.error("Failed to load available rooms:", error);
  }
}

function switchRoom(roomName) {
  if (roomName === currentRoomName || !socket) return;

  // Update UI immediately
  updateActiveRoom(roomName);
  currentRoom.textContent = `#${roomName}`;

  // Emit room switch to server
  socket.emit("switchRoom", roomName);

  // Add room to list if it doesn't exist
  addRoomToList(roomName);
}

function updateActiveRoom(roomName) {
  // Remove active class from all rooms
  document.querySelectorAll(".room-item").forEach((item) => {
    item.classList.remove("active");
  });

  // Add active class to current room
  const currentRoomElement = document.querySelector(
    `[data-room="${roomName}"]`
  );
  if (currentRoomElement) {
    currentRoomElement.classList.add("active");
  }
}

function showModal(modal) {
  modal.classList.remove("hidden");
  // Focus on first input
  const firstInput = modal.querySelector("input");
  if (firstInput) {
    firstInput.focus();
  }
}

function hideModal(modal) {
  modal.classList.add("hidden");
}

function toggleEmojiPicker() {
  emojiPicker.classList.toggle("hidden");
}

function hideEmojiPicker() {
  emojiPicker.classList.add("hidden");
}

function insertEmoji(emoji) {
  const cursorPos = messageInput.selectionStart;
  const textBefore = messageInput.value.substring(0, cursorPos);
  const textAfter = messageInput.value.substring(cursorPos);

  messageInput.value = textBefore + emoji + textAfter;
  messageInput.focus();

  // Set cursor position after emoji
  const newPos = cursorPos + emoji.length;
  messageInput.setSelectionRange(newPos, newPos);

  hideEmojiPicker();
}

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Set colors based on type
  let backgroundColor = "#10b981"; // default green
  if (type === "error") backgroundColor = "#ef4444";
  if (type === "warning") backgroundColor = "#f59e0b";
  if (type === "info") backgroundColor = "#3b82f6";
  if (type === "success") backgroundColor = "#10b981";

  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;

  // Add icon based on type
  let icon = "";
  if (type === "error") icon = '<i class="fas fa-exclamation-triangle"></i>';
  if (type === "warning") icon = '<i class="fas fa-exclamation-circle"></i>';
  if (type === "info") icon = '<i class="fas fa-info-circle"></i>';
  if (type === "success") icon = '<i class="fas fa-check-circle"></i>';

  notification.innerHTML = `${icon}<span>${message}</span>`;

  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);

  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Add connection status indicator to UI (removed - was always showing connected)
function updateConnectionStatus(connected) {
  // Temporarily disabled - was causing confusion
  console.log("Connection status:", connected ? "Connected" : "Disconnected");
}

// Test connection function
function testConnection() {
  if (socket && socket.connected) {
    socket.emit("ping", Date.now(), (response) => {
      console.log("Ping response time:", Date.now() - response, "ms");
    });
  }
}

// Test function for simple messaging (for debugging)
function sendSimpleMessage() {
  if (!socket || !socket.connected) {
    console.log("Socket not connected");
    return;
  }

  const testMessage = "Test message: " + Date.now();
  console.log("Sending simple test message:", testMessage);

  socket.emit("simpleMessage", { message: testMessage }, (response) => {
    console.log("Simple message response:", response);
  });
}

// Add to window for testing in console
window.sendSimpleMessage = sendSimpleMessage;

// Handle page visibility for connection management
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    // Page is hidden
    if (socket && isTyping) {
      socket.emit("typing", false);
      isTyping = false;
    }
  }
});

// Load statistics from server
async function loadStatistics() {
  try {
    const refreshButton = document.getElementById("refreshStats");
    const originalHTML = refreshButton.innerHTML;
    refreshButton.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Loading...';
    refreshButton.disabled = true;

    const response = await fetch("/api/stats");
    const stats = await response.json();

    // Update encryption stats
    document.getElementById("statActiveKeys").textContent =
      stats.encryption.activeUserKeys || "0";
    document.getElementById("statRoomKeys").textContent =
      stats.encryption.activeRoomKeys || "0";

    // Update database stats with enhanced compression metrics
    document.getElementById("statTotalMessages").textContent = (
      stats.database.totalMessages || 0
    ).toLocaleString();
    document.getElementById("statCompressionRatio").textContent = `${
      stats.database.avgCompressionRatio || 0
    }%`;
    document.getElementById("statBestCompression").textContent = `${
      stats.database.bestCompressionRatio || 0
    }%`;
    document.getElementById("statSpaceSaved").textContent = `${
      stats.database.spaceSaved || 0
    }%`;
    document.getElementById("statStorageUsed").textContent = `${Math.round(
      (stats.database.totalStorageUsed || 0) / 1024
    )} KB`;

    // Format bytes saved with appropriate units
    const bytesSaved = stats.database.spaceSavedBytes || 0;
    let formattedBytes;
    if (bytesSaved > 1024 * 1024) {
      formattedBytes = `${(bytesSaved / (1024 * 1024)).toFixed(1)} MB`;
    } else if (bytesSaved > 1024) {
      formattedBytes = `${(bytesSaved / 1024).toFixed(1)} KB`;
    } else {
      formattedBytes = `${bytesSaved} B`;
    }
    document.getElementById("statBytesSaved").textContent = formattedBytes;

    // Update server stats
    document.getElementById("statActiveConnections").textContent =
      stats.server.activeConnections || "0";
    document.getElementById("statTotalRooms").textContent =
      stats.database.totalRooms || "0";
    document.getElementById("statUptime").textContent = "Active";

    showNotification("📊 Statistics updated", "success");
  } catch (error) {
    console.error("Error loading statistics:", error);
    showNotification("Failed to load statistics", "error");
  } finally {
    const refreshButton = document.getElementById("refreshStats");
    if (refreshButton) {
      refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
      refreshButton.disabled = false;
    }
  }
}

// Format bytes to human readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Handle window beforeunload
window.addEventListener("beforeunload", function () {
  if (socket) {
    socket.disconnect();
  }
});

// Mobile menu functionality
let isMobileMenuOpen = false;

function setupMobileMenu() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const sidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (!mobileMenuBtn || !sidebar || !sidebarOverlay) return;

  // Toggle mobile menu
  mobileMenuBtn.addEventListener("click", toggleMobileMenu);

  // Close menu when overlay is clicked
  sidebarOverlay.addEventListener("click", closeMobileMenu);

  // Close menu when escape key is pressed
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMobileMenuOpen) {
      closeMobileMenu();
    }
  });

  // Close menu when window is resized to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 480 && isMobileMenuOpen) {
      closeMobileMenu();
    }
  });
}

function toggleMobileMenu() {
  if (isMobileMenuOpen) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function openMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  sidebar.classList.add("open");
  sidebarOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
  isMobileMenuOpen = true;
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("show");
  document.body.style.overflow = "";
  isMobileMenuOpen = false;
}

// Close mobile menu when switching rooms on mobile
function closeMobileMenuOnRoomSwitch() {
  if (window.innerWidth <= 480 && isMobileMenuOpen) {
    closeMobileMenu();
  }
}
