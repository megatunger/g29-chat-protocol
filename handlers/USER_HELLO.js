"use strict";

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

const authenticatedUsers = new Map();

module.exports = async function userHelloHandler({ socket, data, fastify }) {
  const { userId, publicKey, sessionToken, challenge } = data;

  // Validate required fields
  if (!userId || !publicKey || !sessionToken || !challenge) {
    socket.send(JSON.stringify({
      type: 'ERROR',
      data: {
        code: 'bad_request',
        message: 'Missing required fields: userId, publicKey, sessionToken, challenge'
      }
    }));
    return;
  }

  try {

    const decoded = jwt.verify(sessionToken, JWT_SECRET);
    
    if (decoded.userID !== userId) {
      socket.send(JSON.stringify({
        type: 'ERROR',
        data: {
          code: 'invalid_session',
          message: 'Session token does not match user ID'
        }
      }));
      return;
    }

    // Validate RSA-4096 public key format
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----') || 
        !publicKey.includes('-----END PUBLIC KEY-----')) {
      socket.send(JSON.stringify({
        type: 'ERROR',
        data: {
          code: 'invalid_key',
          message: 'Invalid RSA public key format'
        }
      }));
      return;
    }

    authenticatedUsers.set(userId, {
      publicKey: publicKey,
      socket: socket,
      sessionToken: sessionToken,
      connectedAt: new Date(),
      lastSeen: new Date()
    });


    socket.send(JSON.stringify({
      type: 'PEER_HELLO_JOIN',
      data: {
        userId: userId,
        message: 'Successfully joined secure chat',
        connectedUsers: Array.from(authenticatedUsers.keys()).filter(id => id !== userId)
      }
    }));

    const peerJoinMessage = JSON.stringify({
      type: 'PEER_JOIN',
      data: {
        userId: userId,
        publicKey: publicKey,
        timestamp: Date.now()
      }
    });

    for (const [otherUserId, userData] of authenticatedUsers) {
      if (otherUserId !== userId && userData.socket.readyState === 1) {
        userData.socket.send(peerJoinMessage);
      }
    }

    fastify.log.info({ userId }, 'User successfully authenticated and joined chat');

  } catch (error) {
    fastify.log.error(error, 'USER_HELLO authentication failed');
    
    socket.send(JSON.stringify({
      type: 'ERROR',
      data: {
        code: 'authentication_failed',
        message: 'Invalid session or authentication data'
      }
    }));
  }
};

module.exports.getAuthenticatedUser = function(userId) {
  return authenticatedUsers.get(userId);
};

module.exports.removeAuthenticatedUser = function(userId) {
  return authenticatedUsers.delete(userId);
};

module.exports.getAllAuthenticatedUsers = function() {
  return Array.from(authenticatedUsers.keys());
};