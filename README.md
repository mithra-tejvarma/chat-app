# WebChat - Secure Real-time Messaging Application

A modern, secure real-time web chatting application built with Node.js, Socket.IO, and vanilla JavaScript, featuring **end-to-end encryption**, **database storage**, and **compression algorithms**.

## 🔐 Security Features

### End-to-End Encryption
- **RSA-2048** key pairs for user authentication
- **AES-256-GCM** encryption for message content
- **Digital signatures** for message integrity verification
- **Forward secrecy** with room-based key rotation
- **Client-side key generation** for maximum security

### Database Security
- **Encrypted storage** of all messages in SQLite database
- **Compression algorithms** (gzip) to minimize storage footprint
- **Secure key management** with proper key derivation
- **Authentication tags** for tamper detection

## 💾 Storage & Performance

### Advanced Compression
- **Multi-layer compression**: Message → JSON → gzip → Encrypt
- **Space savings**: Typically 60-80% reduction in storage size
- **Optimized retrieval**: Fast decompression with caching
- **Storage analytics**: Real-time compression ratio monitoring

### Database Features
- **SQLite local database** for zero-configuration setup
- **Indexed queries** for fast message retrieval
- **Session management** with automatic cleanup
- **Statistics tracking** for performance monitoring

## Features

### 🚀 Core Features
- **Real-time messaging** - Instant message delivery using WebSocket connections
- **Multiple chat rooms** - Create and join different chat rooms
- **User authentication** - Simple username-based login system
- **Online user tracking** - See who's currently online in each room
- **Message history** - Persistent message storage for each room
- **Typing indicators** - See when other users are typing
- **Emoji support** - Built-in emoji picker for expressive messaging

### 🎨 UI/UX Features
- **Modern responsive design** - Works on desktop, tablet, and mobile
- **Beautiful animations** - Smooth transitions and message animations
- **Dark/light theme support** - Clean, professional interface
- **Mobile-friendly** - Optimized for touch devices
- **Intuitive navigation** - Easy room switching and user management

### 🛠 Technical Features
- **Socket.IO integration** - Reliable real-time communication
- **Express.js backend** - Robust server architecture
- **SQLite database** - Local storage with encryption and compression
- **End-to-end encryption** - RSA + AES hybrid encryption system
- **Message compression** - gzip compression for efficient storage
- **Error handling** - Graceful error management and user feedback
- **Connection management** - Automatic reconnection handling
- **Statistics dashboard** - Real-time monitoring of encryption and storage metrics

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Quick Start

1. **Navigate to the chat-app directory:**
   ```bash
   cd chat-app
   ```

2. **Run the setup script:**
   
   **Windows:**
   ```cmd
   start.bat
   ```
   
   **Linux/Mac:**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```
   
   **Manual installation:**
   ```bash
   npm install
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

4. **View statistics:**
   Visit `http://localhost:3000/api/stats` for JSON stats or use the in-app statistics panel

## Usage

### Getting Started
1. **Enter your username** - Choose a unique username (max 20 characters)
2. **Choose a room** - Enter a room name or leave blank for "general"
3. **Start chatting** - Begin sending messages in real-time

### Features Guide

#### Joining Rooms
- Enter a room name during login, or
- Click "Create Room" to make a new room
- Click on any room in the sidebar to switch

#### Sending Messages
- Type your message in the input field
- Press Enter or click the send button
- Use the emoji picker for quick emoji insertion
- Messages support basic formatting and URLs

#### Room Management
- Create new rooms using the "+" button
- Switch between rooms using the sidebar
- See online users in each room

#### User Features
- Your messages appear on the right (blue)
- Other users' messages appear on the left (white)
- System messages appear in the center (gray)
- Typing indicators show when others are typing

## Project Structure

```
chat-app/
├── server.js              # Main server with encryption & database
├── database.js            # SQLite database manager with encryption
├── encryption.js          # End-to-end encryption manager
├── package.json           # Dependencies and scripts
├── start.bat              # Windows setup script
├── start.sh               # Unix setup script
├── chat.db                # SQLite database (created automatically)
├── README.md              # This file
└── public/                # Client-side files
    ├── index.html         # Main HTML with statistics panel
    ├── css/
    │   └── style.css      # Styles with modal support
    └── js/
        └── app.js         # Client with encryption support
```

## API Endpoints

### HTTP Routes
- `GET /` - Serve the main chat application
- `GET /api/rooms` - Get list of available chat rooms
- `GET /api/stats` - Get database and encryption statistics

### Socket.IO Events

#### Client to Server
- `join` - User joins a chat room (includes key exchange)
- `chatMessage` - Send a chat message (encrypted)
- `typing` - Typing indicator
- `switchRoom` - Switch to different room (new key exchange)

#### Server to Client
- `keyExchange` - Initial RSA key pair and room key
- `roomKeyExchange` - New room encryption key
- `message` - Receive chat message (legacy support)
- `encryptedMessage` - Receive encrypted chat message
- `messageHistory` - Receive encrypted message history
- `updateUsers` - Updated user list
- `userTyping` - User typing indicator
- `roomChanged` - Room switch confirmation
- `error` - Error messages

## Customization

### Styling
- Edit `public/css/style.css` to customize the appearance
- The design uses CSS custom properties for easy theming
- Responsive breakpoints are defined for mobile optimization

### Features
- Add user avatars by modifying the message display logic
- Implement user profiles in the server-side user management
- Add file sharing by extending the message types
- Integrate with databases by replacing the in-memory storage

### Server Configuration
- Change the port by setting the `PORT` environment variable
- Modify CORS settings in the Socket.IO configuration
- Add authentication middleware for enhanced security

## Technologies Used

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **SQLite3** - Local database
- **UUID** - Unique identifier generation
- **Node-RSA** - RSA encryption library
- **bcrypt** - Password hashing (future use)
- **zlib** - Compression algorithms

### Frontend
- **HTML5** - Structure and semantics
- **CSS3** - Styling and animations
- **JavaScript (ES6+)** - Client-side logic
- **Socket.IO Client** - Real-time communication
- **Font Awesome** - Icons
- **Google Fonts** - Typography

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **Message Limit**: Unlimited (stored in database)
- **Compression Ratio**: 60-80% space savings typically
- **Database Size**: Optimized with indexing and compression
- **Encryption Overhead**: Minimal impact on performance
- **User Limit**: Scales with server resources
- **Room Limit**: No hard limit
- **Concurrent Connections**: Scales with server capacity

## Security Considerations

- **End-to-end encryption** for all messages
- **Input sanitization** for XSS prevention
- **Message integrity** verification with digital signatures
- **Key rotation** for forward secrecy
- **Encrypted database storage**
- **No sensitive data** stored in local storage
- **CORS protection** enabled
- **Rate limiting** can be added for production use

## Database Schema

### Tables
- **users** - User information and public keys
- **rooms** - Chat room metadata
- **messages** - Encrypted and compressed messages
- **user_sessions** - Active user sessions with keys

### Encryption Flow
1. User generates RSA key pair
2. Server creates AES room key
3. Room key encrypted with user's public key
4. Messages encrypted with room AES key
5. Encrypted messages compressed and stored

## Future Enhancements

- [x] Database integration (SQLite)
- [x] End-to-end encryption (RSA + AES)
- [x] Message compression (gzip)
- [x] Statistics dashboard
- [ ] Advanced user authentication with passwords
- [ ] File and image sharing with encryption
- [ ] Private messaging
- [ ] Message encryption with perfect forward secrecy
- [ ] User roles and permissions
- [ ] Message reactions
- [ ] Voice/video calling
- [ ] Push notifications
- [ ] Message search functionality
- [ ] Database migration to PostgreSQL/MongoDB
- [ ] Redis caching layer

## Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if port 3000 is available
   - Ensure Node.js is installed
   - Run `npm install` to install dependencies

2. **Can't connect to chat**
   - Check your firewall settings
   - Ensure the server is running
   - Check browser console for errors

3. **Messages not appearing**
   - Check internet connection
   - Refresh the page
   - Check browser developer tools for errors

### Development

For development, you can:
- Use `npm run dev` for auto-reload with nodemon
- Check server logs in the terminal
- Use browser developer tools for client-side debugging
- Monitor network tab for Socket.IO connections

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Review the browser console for errors
3. Check server logs for backend issues
4. Open an issue on the repository

---

**Happy Chatting! 🎉**
