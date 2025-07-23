@echo off
echo 🚀 Setting up Secure Web Chat Application...
echo.

echo 📦 Installing dependencies...
call npm install

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ Dependencies installed successfully!
    echo.
    echo 🔐 Starting secure chat server with:
    echo    - End-to-end encryption
    echo    - Database storage with compression
    echo    - Real-time messaging
    echo.
    echo 🌐 Server will be available at: http://localhost:3000
    echo 📊 Statistics available at: http://localhost:3000/api/stats
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    call npm start
) else (
    echo ❌ Failed to install dependencies!
    echo Please check your internet connection and try again.
    pause
)
