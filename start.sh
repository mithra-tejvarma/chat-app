#!/bin/bash

echo "🚀 Setting up Secure Web Chat Application..."
echo

echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo
    echo "✅ Dependencies installed successfully!"
    echo
    echo "🔐 Starting secure chat server with:"
    echo "   - End-to-end encryption"
    echo "   - Database storage with compression"
    echo "   - Real-time messaging"
    echo
    echo "🌐 Server will be available at: http://localhost:3000"
    echo "📊 Statistics available at: http://localhost:3000/api/stats"
    echo
    echo "Press Ctrl+C to stop the server"
    echo
    npm start
else
    echo
    echo "❌ Failed to install dependencies!"
    echo "Please check your internet connection and try again."
    read -p "Press any key to continue..."
fi
