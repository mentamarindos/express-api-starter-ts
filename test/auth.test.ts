import request from 'supertest';
import app from '../src/app';
import { db, users, quoteRequests, quotes, contracts, productionStatus, notifications } from '../src/db/schema';
import { hashPassword } from '../src/utils/auth';
import { eq } from 'drizzle-orm';

describe('Authentication endpoints', () => {
  beforeEach(async () => {
    // Clear tables (children first to satisfy foreign keys)
    await db.delete(notifications);
    await db.delete(productionStatus);
    await db.delete(contracts);
    await db.delete(quotes);
    await db.delete(quoteRequests);
    await db.delete(users);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new customer user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'customer@example.com',
              password: 'password123',
              firstName: 'John',
              lastName: 'Doe',
              role: 'customer'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.attributes).toHaveProperty('token');
      expect(response.body.data.attributes.email).toBe('customer@example.com');
      expect(response.body.data.attributes.role).toBe('customer');
    });

    it('should not allow registering as admin', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'admin@example.com',
              password: 'password123',
              firstName: 'Admin',
              lastName: 'User',
              role: 'admin'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });

    it('should not allow duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'password123',
              firstName: 'Test',
              lastName: 'User',
              role: 'customer'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      // Duplicate registration attempt
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'differentpassword',
              firstName: 'Another',
              lastName: 'User',
              role: 'customer'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await hashPassword('password123');
      await db.insert(users).values({
        id: '1',
        email: 'test@example.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
        isActive: true
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'password123'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes).toHaveProperty('token');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'wrongpassword'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(401);
    });

    it('should not login inactive user', async () => {
      // Update user to inactive
      await db.update(users)
        .set({ isActive: false })
        .where(eq(users.id, '1'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'password123'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      // Valid credentials but the account is disabled
      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create a user and get auth token
      const passwordHash = await hashPassword('password123');
      await db.insert(users).values({
        id: '1',
        email: 'test@example.com',
        passwordHash,
        firstName: 'Test',
        lastName: 'User',
        role: 'customer',
        isActive: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          data: {
            type: 'users',
            attributes: {
              email: 'test@example.com',
              password: 'password123'
            }
          }
        })
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      authToken = loginResponse.body.data.attributes.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes.email).toBe('test@example.com');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(401);
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(401);
    });
  });
});