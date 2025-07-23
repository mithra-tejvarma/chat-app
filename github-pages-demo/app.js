// GitHub Pages Demo Version - Simulated Chat Functionality
// This version works without a backend server for demonstration

// Demo configuration
const DEMO_MODE = true;
const DEMO_USERS = ['Alice', 'Bob', 'Charlie', 'Diana'];
const DEMO_MESSAGES = [
    { username: 'Alice', message: 'Hey everyone! This compression is amazing!', timestamp: new Date(Date.now() - 300000) },
    { username: 'Bob', message: 'The Brotli compression saves so much space 🚀', timestamp: new Date(Date.now() - 240000) },
    { username: 'Charlie', message: 'End-to-end encryption working perfectly!', timestamp: new Date(Date.now() - 180000) },
    { username: 'Diana', message: 'Private rooms with passwords are so secure 🔒', timestamp: new Date(Date.now() - 120000) }
];

// Copy your existing DOM elements and variables
// ... (copy from your original app.js but modify for demo)

let demoMessageCounter = 0;
let currentUser = null;
let currentRoomName = 'general';

// Simulated localStorage for demo persistence
const DemoStorage = {
    getMessages(room) {
        const messages = JSON.parse(localStorage.getItem(`demo_messages_${room}`) || '[]');
        return messages.concat(DEMO_MESSAGES);
    },
    
    addMessage(room, message) {
        const messages = this.getMessages(room);
        messages.push(message);
        localStorage.setItem(`demo_messages_${room}`, JSON.stringify(messages));
    },
    
    getRooms() {
        return JSON.parse(localStorage.getItem('demo_rooms') || '[{"name":"general","isPrivate":false,"description":"Main chat room"}]');
    },
    
    addRoom(room) {
        const rooms = this.getRooms();
        if (!rooms.find(r => r.name === room.name)) {
            rooms.push(room);
            localStorage.setItem('demo_rooms', JSON.stringify(rooms));
        }
    }
};

// Demo statistics
const DemoStats = {
    getStats() {
        const totalMessages = Object.keys(localStorage).filter(k => k.startsWith('demo_messages_')).length * 4;
        return {
            database: {
                totalMessages: totalMessages + 15,
                avgCompressionRatio: '73.2',
                bestCompressionRatio: '89.1',
                spaceSaved: '73.2',
                totalStorageUsed: 2048,
                spaceSavedBytes: 5632,
                totalRooms: 3
            },
            encryption: {
                activeUserKeys: 4,
                activeRoomKeys: 3
            },
            server: {
                activeConnections: 4
            }
        };
    }
};

// Initialize demo
document.addEventListener('DOMContentLoaded', function() {
    // Add demo banner styling
    addDemoStyles();
    
    // Copy your existing initialization but modify for demo
    setupEventListeners();
    
    // Add demo-specific features
    simulateTypingIndicators();
    simulateUserActivity();
});

function addDemoStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .demo-banner {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem;
            text-align: center;
            font-size: 0.9rem;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .demo-banner .github-link {
            color: white;
            text-decoration: none;
            margin-left: 1rem;
            padding: 0.3rem 0.8rem;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 4px;
            transition: all 0.3s ease;
        }
        
        .demo-banner .github-link:hover {
            background: rgba(255,255,255,0.1);
            transform: translateY(-1px);
        }
        
        body {
            padding-top: 60px;
        }
        
        .demo-indicator {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ff6b6b;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
}

// Demo message sending
function handleSendMessage(e) {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message || !currentUser) return;
    
    const newMessage = {
        id: `demo_${Date.now()}`,
        username: currentUser.username,
        message: message,
        timestamp: new Date(),
        type: 'user',
        encrypted: true
    };
    
    // Add to demo storage
    DemoStorage.addMessage(currentRoomName, newMessage);
    
    // Display message
    displayMessage(newMessage);
    scrollToBottom();
    
    // Clear input
    messageInput.value = '';
    
    // Simulate compression notification
    const compressionRatio = Math.floor(Math.random() * 30) + 60; // 60-90%
    showNotification(`💾 Message compressed: ${compressionRatio}% space saved`, 'success');
    
    // Simulate bot response after delay
    setTimeout(() => {
        simulateBotResponse();
    }, 2000 + Math.random() * 3000);
}

function simulateBotResponse() {
    const responses = [
        "Great point! The compression really makes a difference.",
        "I love how secure this chat feels with the encryption 🔒",
        "The UI is so clean and modern!",
        "Brotli compression is definitely superior to gzip.",
        "This would be perfect for team communications.",
        "The real-time features work seamlessly!"
    ];
    
    const randomUser = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    const botMessage = {
        id: `demo_bot_${Date.now()}`,
        username: randomUser,
        message: response,
        timestamp: new Date(),
        type: 'user',
        encrypted: true
    };
    
    displayMessage(botMessage);
    scrollToBottom();
    
    showNotification(`💬 ${randomUser} sent a message`, 'info');
}

// Copy and modify your existing functions for demo mode
// ... (copy other functions but remove Socket.IO dependencies)

// Demo-specific functions
function simulateTypingIndicators() {
    setInterval(() => {
        if (Math.random() < 0.1) { // 10% chance every 5 seconds
            const randomUser = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
            const typingIndicator = document.getElementById('typingIndicator');
            const typingText = document.getElementById('typingText');
            
            if (typingIndicator && typingText) {
                typingText.textContent = `${randomUser} is typing...`;
                typingIndicator.classList.remove('hidden');
                
                setTimeout(() => {
                    typingIndicator.classList.add('hidden');
                }, 2000);
            }
        }
    }, 5000);
}

function simulateUserActivity() {
    // Simulate users joining/leaving
    setInterval(() => {
        if (Math.random() < 0.05) { // 5% chance every 10 seconds
            const action = Math.random() < 0.7 ? 'joined' : 'left';
            const randomUser = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)];
            showNotification(`👤 ${randomUser} ${action} the chat`, 'info');
        }
    }, 10000);
}

// Demo login function
function handleLogin(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('usernameInput');
    const roomInput = document.getElementById('roomInput');
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim() || 'general';
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    currentUser = { username, room };
    currentRoomName = room;
    
    // Show chat app
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatApp').classList.remove('hidden');
    
    // Load demo messages
    loadDemoMessages();
    
    // Simulate connection
    showNotification('🔗 Connected to demo chat server', 'success');
    setTimeout(() => {
        showNotification('🔐 End-to-end encryption established', 'success');
    }, 1000);
}

function loadDemoMessages() {
    const messages = DemoStorage.getMessages(currentRoomName);
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '';
    
    messages.forEach(message => {
        message.encrypted = true;
        displayMessage(message, false);
    });
    
    scrollToBottom();
    showNotification(`📜 Loaded ${messages.length} encrypted messages`, 'info');
}

// Demo statistics
async function loadStatistics() {
    const stats = DemoStats.getStats();
    
    // Update UI with demo stats
    document.getElementById('statTotalMessages').textContent = stats.database.totalMessages.toLocaleString();
    document.getElementById('statCompressionRatio').textContent = `${stats.database.avgCompressionRatio}%`;
    document.getElementById('statBestCompression').textContent = `${stats.database.bestCompressionRatio}%`;
    document.getElementById('statSpaceSaved').textContent = `${stats.database.spaceSaved}%`;
    document.getElementById('statStorageUsed').textContent = `${Math.round(stats.database.totalStorageUsed / 1024)} KB`;
    document.getElementById('statBytesSaved').textContent = `${(stats.database.spaceSavedBytes / 1024).toFixed(1)} KB`;
    document.getElementById('statActiveConnections').textContent = stats.server.activeConnections;
    document.getElementById('statTotalRooms').textContent = stats.database.totalRooms;
    
    showNotification('📊 Demo statistics updated', 'success');
}

// Add demo indicator to messages
function displayMessage(message, animate = true) {
    // Copy your existing displayMessage function
    // Add demo indicator for demo messages
    // ... implementation
}

// Export for GitHub Pages
window.DemoChat = {
    handleLogin,
    handleSendMessage,
    loadStatistics,
    simulateBotResponse
};
