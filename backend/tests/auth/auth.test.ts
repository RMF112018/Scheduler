import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prisma } from '../setup';

// Import the app - we need to create a test version that doesn't start the server
import express from 'express';
import cors from 'cors';
import authRoutes from '../../src/routes/authRoutes.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

// Create a test app instance
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use(errorHandler);

describe('Auth Endpoints', () => {
  let testCompany: { id: string; name: string };

  beforeEach(async () => {
    // Create a test company for user registration
    testCompany = await prisma.company.create({
      data: { name: 'Test Company' },
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with company name', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'TestPassword123!',
          firstName: 'John',
          lastName: 'Doe',
          companyName: 'New Test Company',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('newuser@test.com');
      expect(response.body.user.firstName).toBe('John');
      expect(response.body.user.lastName).toBe('Doe');
    });

    it('should register a new user with existing company ID', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'anotheruser@test.com',
          password: 'TestPassword123!',
          firstName: 'Jane',
          lastName: 'Smith',
          companyId: testCompany.id,
        });

      expect(response.status).toBe(201);
      expect(response.body.user.companyId).toBe(testCompany.id);
    });

    it('should return 400 for duplicate email', async () => {
      // Create a user first
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      await prisma.user.create({
        data: {
          email: 'duplicate@test.com',
          passwordHash,
          firstName: 'Existing',
          lastName: 'User',
          role: 'user',
          companyId: testCompany.id,
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@test.com',
          password: 'TestPassword123!',
          firstName: 'New',
          lastName: 'User',
          companyId: testCompany.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already registered');
    });

    it('should return 400 when neither company ID nor company name provided', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'nocompany@test.com',
          password: 'TestPassword123!',
          firstName: 'No',
          lastName: 'Company',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const passwordHash = await bcrypt.hash('TestPassword123!', 12);
      await prisma.user.create({
        data: {
          email: 'login@test.com',
          passwordHash,
          firstName: 'Login',
          lastName: 'User',
          role: 'user',
          companyId: testCompany.id,
        },
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@test.com',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('login@test.com');
    });

    it('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid');
    });

    it('should handle case-insensitive email login', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'LOGIN@TEST.COM',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('login@test.com');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      // First, register a user to get tokens
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'refresh@test.com',
          password: 'TestPassword123!',
          firstName: 'Refresh',
          lastName: 'User',
          companyName: 'Refresh Company',
        });

      const { refreshToken } = registerResponse.body;

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logged out');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user when authenticated', async () => {
      // Register and get token
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'me@test.com',
          password: 'TestPassword123!',
          firstName: 'Current',
          lastName: 'User',
          companyName: 'Me Company',
        });

      const { token } = registerResponse.body;

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('me@test.com');
      expect(response.body.firstName).toBe('Current');
      expect(response.body.lastName).toBe('User');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
