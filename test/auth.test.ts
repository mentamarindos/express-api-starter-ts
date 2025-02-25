import request from 'supertest';
import app from '../src/app';
import { db, users } from '../src/db/schema';
import { hashPassword } from '../src/utils/auth';

describe('Auth endpoints', () => {
  beforeEach(async () => {
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

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.attributes).toHaveProperty('token');
      expect(response.body.data.attributes.email).toBe('test@example.com');
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
  });
});