# Render.com Configuration

## Environment Variables to Set in Render Dashboard:

- `NODE_ENV`: `production`
- `DB_ENCRYPTION_KEY`: `your-secure-encryption-key-here`
- `PORT`: (Render sets this automatically)

## Build Command:

```
npm install
```

## Start Command:

```
npm start
```

## Health Check URL:

```
/health
```

## Notes:

- Render automatically sets PORT environment variable
- Database file will be created in the container
- CORS is configured to allow all origins for development
- Socket.IO is configured with both websocket and polling transports
