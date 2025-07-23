const crypto = require('crypto');
const NodeRSA = require('node-rsa');

class EncryptionManager {
    constructor() {
        this.userKeys = new Map(); // Store user RSA key pairs
        this.roomKeys = new Map();  // Store room AES keys
    }

    // Generate RSA key pair for a user
    generateUserKeyPair() {
        const key = new NodeRSA({ b: 2048 });
        return {
            publicKey: key.exportKey('public'),
            privateKey: key.exportKey('private'),
            keyObject: key
        };
    }

    // Generate AES key for room-based encryption
    generateRoomKey() {
        return crypto.randomBytes(32); // 256-bit key
    }

    // Store user keys
    storeUserKeys(socketId, keyPair) {
        this.userKeys.set(socketId, keyPair);
    }

    // Get user keys
    getUserKeys(socketId) {
        return this.userKeys.get(socketId);
    }

    // Remove user keys
    removeUserKeys(socketId) {
        this.userKeys.delete(socketId);
    }

    // Store room key
    storeRoomKey(roomName, key) {
        this.roomKeys.set(roomName, key);
    }

    // Get or create room key
    getRoomKey(roomName) {
        if (!this.roomKeys.has(roomName)) {
            this.roomKeys.set(roomName, this.generateRoomKey());
        }
        return this.roomKeys.get(roomName);
    }

    // Encrypt message with AES for room
    encryptMessageForRoom(message, roomName) {
        try {
            const roomKey = this.getRoomKey(roomName);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-gcm', roomKey);
            
            let encrypted = cipher.update(JSON.stringify(message), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex')
            };
        } catch (error) {
            console.error('Message encryption error:', error);
            throw error;
        }
    }

    // Decrypt message with AES for room
    decryptMessageForRoom(encryptedData, roomName) {
        try {
            const roomKey = this.getRoomKey(roomName);
            const decipher = crypto.createDecipher('aes-256-gcm', roomKey);
            
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Message decryption error:', error);
            throw error;
        }
    }

    // Encrypt room key for specific user (for key exchange)
    encryptRoomKeyForUser(roomName, userPublicKey) {
        try {
            const roomKey = this.getRoomKey(roomName);
            const key = new NodeRSA(userPublicKey);
            return key.encrypt(roomKey, 'base64');
        } catch (error) {
            console.error('Room key encryption error:', error);
            throw error;
        }
    }

    // Decrypt room key with user's private key
    decryptRoomKeyForUser(encryptedRoomKey, userPrivateKey) {
        try {
            const key = new NodeRSA(userPrivateKey);
            return key.decrypt(encryptedRoomKey, 'buffer');
        } catch (error) {
            console.error('Room key decryption error:', error);
            throw error;
        }
    }

    // Generate message hash for integrity verification
    generateMessageHash(message) {
        return crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex');
    }

    // Verify message integrity
    verifyMessageIntegrity(message, hash) {
        const computedHash = this.generateMessageHash(message);
        return computedHash === hash;
    }

    // Create encrypted message packet
    createEncryptedMessage(messageData, roomName, senderSocketId) {
        try {
            // Get sender's keys
            const senderKeys = this.getUserKeys(senderSocketId);
            if (!senderKeys) {
                throw new Error('Sender keys not found');
            }

            // Create message with metadata
            const messagePacket = {
                content: messageData.message,
                timestamp: new Date().toISOString(),
                sender: messageData.username,
                messageId: messageData.messageId,
                room: roomName
            };

            // Generate message hash for integrity
            const messageHash = this.generateMessageHash(messagePacket);
            
            // Encrypt the message for the room
            const encryptedMessage = this.encryptMessageForRoom(messagePacket, roomName);
            
            // Sign the message with sender's private key
            const signature = senderKeys.keyObject.sign(messageHash, 'base64');

            return {
                encrypted: encryptedMessage,
                signature: signature,
                senderPublicKey: senderKeys.publicKey,
                messageHash: messageHash
            };
        } catch (error) {
            console.error('Create encrypted message error:', error);
            throw error;
        }
    }

    // Verify and decrypt message
    verifyAndDecryptMessage(encryptedPacket, roomName) {
        try {
            // Verify signature
            const senderKey = new NodeRSA(encryptedPacket.senderPublicKey);
            const isValidSignature = senderKey.verify(
                encryptedPacket.messageHash, 
                encryptedPacket.signature, 
                'utf8', 
                'base64'
            );

            if (!isValidSignature) {
                throw new Error('Invalid message signature');
            }

            // Decrypt message
            const decryptedMessage = this.decryptMessageForRoom(encryptedPacket.encrypted, roomName);
            
            // Verify message integrity
            const isValidHash = this.verifyMessageIntegrity(decryptedMessage, encryptedPacket.messageHash);
            if (!isValidHash) {
                throw new Error('Message integrity check failed');
            }

            return decryptedMessage;
        } catch (error) {
            console.error('Verify and decrypt message error:', error);
            throw error;
        }
    }

    // Get room key exchange data for new user
    getRoomKeyExchangeData(roomName, userPublicKey) {
        try {
            return {
                roomName: roomName,
                encryptedRoomKey: this.encryptRoomKeyForUser(roomName, userPublicKey),
                keyId: crypto.randomBytes(16).toString('hex')
            };
        } catch (error) {
            console.error('Room key exchange error:', error);
            throw error;
        }
    }

    // Clean up room keys for empty rooms
    cleanupEmptyRoomKeys(activeRooms) {
        for (const [roomName] of this.roomKeys) {
            if (!activeRooms.includes(roomName)) {
                this.roomKeys.delete(roomName);
                console.log(`Cleaned up key for empty room: ${roomName}`);
            }
        }
    }

    // Get encryption statistics
    getEncryptionStats() {
        return {
            activeUserKeys: this.userKeys.size,
            activeRoomKeys: this.roomKeys.size,
            totalKeysManaged: this.userKeys.size + this.roomKeys.size
        };
    }
}

module.exports = EncryptionManager;
