"use strict";

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = pro  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body;
    
    // DEBUG: Log what we received
    console.log('🔍 Login attempt - Username:', username, 'Password length:', password?.length);

    if (!username || !password) {
      return reply.status(400).send({
        error: 'bad_request',
        message: 'Username and password are required'
      });
    }JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const BCRYPT_ROUNDS = 12;


const users = new Map([

  ["varun", {
    userID: "varun-uuid-123",
    username: "varun",
    passwordHash: "$2b$12$GtVhzQs2NxBZNigjXQ7uTe0uBQd8/VD70GP.IGktGqg.6KleIw2Tq", // securepass123
    salt: "random-salt-varun",
    publicKey: null,
    isActive: true,
    createdAt: new Date(),
    lastLogin: null
  }],

]);


const activeSessions = new Map();

module.exports = async function (fastify) {

  fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body;
    
    // Debug logging
    console.log('🔍 Login attempt:', { username, password: '***' });
    console.log('🗄️ Available users:', Array.from(users.keys()));

    if (!username || !password) {
      console.log('❌ Missing credentials');
      return reply.status(400).send({
        error: 'bad_request',
        message: 'Username and password are required'
      });
    }

    const user = users.get(username);
    if (!user || !user.isActive) {
      return reply.status(401).send({
        error: 'invalid_credentials',
        message: 'Invalid username or password'
      });
    }


    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return reply.status(401).send({
        error: 'invalid_credentials', 
        message: 'Invalid username or password'
      });
    }

    const sessionToken = jwt.sign(
      { 
        userID: user.userID,
        username: user.username,
        sessionID: crypto.randomUUID()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const challenge = crypto.randomBytes(32).toString('hex');

    // Store session
    activeSessions.set(sessionToken, {
      userID: user.userID,
      username: user.username,
      challenge: challenge,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), 
      ipAddress: request.ip
    });

    user.lastLogin = new Date();

    fastify.log.info({ userID: user.userID }, 'User authenticated successfully');

    return reply.send({
      sessionToken,
      userID: user.userID,
      challenge,
      message: 'Authentication successful'
    });
  });
  fastify.post('/api/auth/validate', async (request, reply) => {
    const { sessionToken } = request.body;

    if (!sessionToken) {
      return reply.status(400).send({
        error: 'bad_request',
        message: 'Session token is required'
      });
    }

    // Verify JWT
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET);
      const session = activeSessions.get(sessionToken);

      if (!session || session.expiresAt < new Date()) {
        activeSessions.delete(sessionToken);
        return reply.status(401).send({
          error: 'invalid_session',
          message: 'Session expired or invalid'
        });
      }

      return reply.send({
        valid: true,
        userID: session.userID,
        username: session.username
      });
    } catch (error) {
      return reply.status(401).send({
        error: 'invalid_session',
        message: 'Invalid session token'
      });
    }
  });

  // Logout endpoint
  fastify.post('/api/auth/logout', async (request, reply) => {
    const { sessionToken } = request.body;

    if (sessionToken && activeSessions.has(sessionToken)) {
      activeSessions.delete(sessionToken);
    }

    return reply.send({ message: 'Logged out successfully' });
  });

  // User registration endpoint (for production)
  fastify.post('/api/auth/register', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.status(400).send({
        error: 'bad_request',
        message: 'Username and password are required'
      });
    }

    if (password.length < 8) {
      return reply.status(400).send({
        error: 'weak_password',
        message: 'Password must be at least 8 characters long'
      });
    }

    if (users.has(username)) {
      return reply.status(409).send({
        error: 'user_exists',
        message: 'Username already exists'
      });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userID = crypto.randomUUID();
    users.set(username, {
      userID,
      username,
      passwordHash,
      salt,
      publicKey: null,
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    });

    fastify.log.info({ userID }, 'New user registered');

    return reply.status(201).send({
      userID,
      username,
      message: 'User registered successfully'
    });
  });
};