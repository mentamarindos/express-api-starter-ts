import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../src/app';
import { db, users, quoteRequests, quotes, contracts, productionStatus, notifications, products, materials, openingTypes, profileTypes, UserRole } from '../src/db/schema';
import { hashPassword, generateToken } from '../src/utils/auth';

describe('Quotes endpoints', () => {
  let customerToken: string;
  let manufacturerToken: string;
  let quoteRequestId: string;

  beforeEach(async () => {
    // Clear relevant tables (children first to satisfy foreign keys)
    await db.delete(notifications);
    await db.delete(productionStatus);
    await db.delete(contracts);
    await db.delete(quotes);
    await db.delete(quoteRequests);
    await db.delete(users);
    await db.delete(products);
    await db.delete(materials);
    await db.delete(openingTypes);
    await db.delete(profileTypes);

    // Create test users
    const passwordHash = await hashPassword('password123');
    
    const [customer, manufacturer] = await Promise.all([
      db.insert(users).values({
        id: '1',
        email: 'customer@example.com',
        passwordHash,
        firstName: 'Customer',
        lastName: 'Test',
        role: UserRole.CUSTOMER,
        isActive: true
      }).returning(),
      db.insert(users).values({
        id: '2',
        email: 'manufacturer@example.com',
        passwordHash,
        firstName: 'Manufacturer',
        lastName: 'Test',
        role: UserRole.MANUFACTURER,
        isActive: true
      }).returning()
    ]);

    // Generate tokens
    customerToken = generateToken({
      id: customer[0].id,
      email: customer[0].email,
      role: customer[0].role as UserRole
    });
    manufacturerToken = generateToken({
      id: manufacturer[0].id,
      email: manufacturer[0].email,
      role: manufacturer[0].role as UserRole
    });

    // Create test product, material, etc.
    const [product, material, openingType, profileType] = await Promise.all([
      db.insert(products).values({
        id: '1',
        name: 'Test Product',
        category: 'Test Category',
        description: 'Test Description'
      }).returning(),
      db.insert(materials).values({
        id: '1',
        name: 'Test Material',
        description: 'Test Description'
      }).returning(),
      db.insert(openingTypes).values({
        id: '1',
        name: 'Test Opening Type',
        description: 'Test Description'
      }).returning(),
      db.insert(profileTypes).values({
        id: '1',
        name: 'Test Profile Type',
        description: 'Test Description'
      }).returning()
    ]);

    // Create a quote request
    const quoteRequest = await db.insert(quoteRequests).values({
      id: '1',
      customerId: customer[0].id,
      productId: product[0].id,
      materialId: material[0].id,
      openingTypeId: openingType[0].id,
      profileTypeId: profileType[0].id,
      width: 1000,
      height: 2000,
      quantity: 1,
      status: 'pending'
    }).returning();

    quoteRequestId = quoteRequest[0].id;
  });

  describe('POST /api/quotes', () => {
    it('should create a quote as manufacturer', async () => {
      const response = await request(app)
        .post('/api/quotes')
        .send({
          data: {
            type: 'quotes',
            attributes: {
              quoteRequestId,
              price: 1000,
              deliveryTimeInDays: 14,
              validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              additionalNotes: 'Test notes'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(201);
      expect(response.body.data.attributes.price).toBe(1000);
      expect(response.body.data.attributes.status).toBe('pending');
    });

    it('should not allow customers to create quotes', async () => {
      const response = await request(app)
        .post('/api/quotes')
        .send({
          data: {
            type: 'quotes',
            attributes: {
              quoteRequestId,
              price: 1000,
              deliveryTimeInDays: 14,
              validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        })
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/quotes', () => {
    beforeEach(async () => {
      // Create a test quote
      await db.insert(quotes).values({
        id: '1',
        quoteRequestId,
        manufacturerId: '2', // manufacturer's ID
        price: 1000,
        deliveryTimeInDays: 14,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      });
    });

    it('should list quotes for manufacturer', async () => {
      const response = await request(app)
        .get('/api/quotes')
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should list quotes for customer', async () => {
      const response = await request(app)
        .get('/api/quotes')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('PUT /api/quotes/:id', () => {
    let quoteId: string;

    beforeEach(async () => {
      // Create a test quote
      const quote = await db.insert(quotes).values({
        id: '1',
        quoteRequestId,
        manufacturerId: '2', // manufacturer's ID
        price: 1000,
        deliveryTimeInDays: 14,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      }).returning();

      quoteId = quote[0].id;
    });

    it('should allow manufacturer to update their quote', async () => {
      const response = await request(app)
        .put(`/api/quotes/${quoteId}`)
        .send({
          data: {
            type: 'quotes',
            attributes: {
              price: 1500,
              deliveryTimeInDays: 10
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes.price).toBe(1500);
      expect(response.body.data.attributes.deliveryTimeInDays).toBe(10);
    });

    it('should allow customer to accept quote', async () => {
      const response = await request(app)
        .put(`/api/quotes/${quoteId}`)
        .send({
          data: {
            type: 'quotes',
            attributes: {
              status: 'accepted'
            }
          }
        })
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes.status).toBe('accepted');
    });
  });

  describe('DELETE /api/quotes/:id', () => {
    let quoteId: string;

    beforeEach(async () => {
      // Create a test quote
      const quote = await db.insert(quotes).values({
        id: '1',
        quoteRequestId,
        manufacturerId: '2', // manufacturer's ID
        price: 1000,
        deliveryTimeInDays: 14,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      }).returning();

      quoteId = quote[0].id;
    });

    it('should allow manufacturer to delete their pending quote', async () => {
      const response = await request(app)
        .delete(`/api/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(204);
    });

    it('should not allow customer to delete quote', async () => {
      const response = await request(app)
        .delete(`/api/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });

    it('should not allow deleting accepted quote', async () => {
      // Update quote to accepted status
      await db.update(quotes)
        .set({ status: 'accepted' })
        .where(eq(quotes.id, quoteId));

      const response = await request(app)
        .delete(`/api/quotes/${quoteId}`)
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });
  });
});