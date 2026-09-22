import request from 'supertest';
import app from '../src/app';
import { eq } from 'drizzle-orm';
import { db, users, quoteRequests, quotes, contracts, productionStatus, notifications, products, materials, openingTypes, profileTypes, UserRole } from '../src/db/schema';
import { hashPassword, generateToken } from '../src/utils/auth';

describe('Contracts endpoints', () => {
  let customerToken: string;
  let manufacturerToken: string;
  let acceptedQuoteId: string;

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

    // Create test resources
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
      status: 'accepted'
    }).returning();

    // Create an accepted quote
    const quote = await db.insert(quotes).values({
      id: '1',
      quoteRequestId: quoteRequest[0].id,
      manufacturerId: manufacturer[0].id,
      price: 1000,
      deliveryTimeInDays: 14,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'accepted'
    }).returning();

    acceptedQuoteId = quote[0].id;
  });

  describe('POST /api/contracts', () => {
    it('should create a contract as manufacturer', async () => {
      const response = await request(app)
        .post('/api/contracts')
        .send({
          data: {
            type: 'contracts',
            attributes: {
              quoteId: acceptedQuoteId,
              contractNumber: 'CNT-001',
              documentUrl: 'https://example.com/contract.pdf'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(201);
      expect(response.body.data.attributes.contractNumber).toBe('CNT-001');
      expect(response.body.data.attributes.status).toBe('pending');
    });

    it('should not allow customers to create contracts', async () => {
      const response = await request(app)
        .post('/api/contracts')
        .send({
          data: {
            type: 'contracts',
            attributes: {
              quoteId: acceptedQuoteId,
              contractNumber: 'CNT-001'
            }
          }
        })
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });

    it('should not allow duplicate contract numbers', async () => {
      // Create first contract
      await request(app)
        .post('/api/contracts')
        .send({
          data: {
            type: 'contracts',
            attributes: {
              quoteId: acceptedQuoteId,
              contractNumber: 'CNT-001'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      // Try to create second contract with same number
      const response = await request(app)
        .post('/api/contracts')
        .send({
          data: {
            type: 'contracts',
            attributes: {
              quoteId: acceptedQuoteId,
              contractNumber: 'CNT-001'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(409);
    });
  });

  describe('GET /api/contracts', () => {
    beforeEach(async () => {
      // Create a test contract
      await db.insert(contracts).values({
        id: '1',
        quoteId: acceptedQuoteId,
        contractNumber: 'CNT-001',
        status: 'pending'
      });
    });

    it('should list contracts for manufacturer', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should list contracts for customer', async () => {
      const response = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('PUT /api/contracts/:id', () => {
    let contractId: string;

    beforeEach(async () => {
      // Create a test contract
      const contract = await db.insert(contracts).values({
        id: '1',
        quoteId: acceptedQuoteId,
        contractNumber: 'CNT-001',
        status: 'pending'
      }).returning();

      contractId = contract[0].id;
    });

    it('should allow manufacturer to update contract document', async () => {
      const response = await request(app)
        .put(`/api/contracts/${contractId}`)
        .send({
          data: {
            type: 'contracts',
            attributes: {
              documentUrl: 'https://example.com/updated-contract.pdf'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes.documentUrl).toBe('https://example.com/updated-contract.pdf');
    });

    it('should allow customer to sign contract', async () => {
      const response = await request(app)
        .put(`/api/contracts/${contractId}`)
        .send({
          data: {
            type: 'contracts',
            attributes: {
              signedDocumentUrl: 'https://example.com/signed-contract.pdf',
              signedAt: new Date().toISOString()
            }
          }
        })
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes.status).toBe('signed');
      expect(response.body.data.attributes.signedDocumentUrl).toBe('https://example.com/signed-contract.pdf');
    });
  });

  describe('DELETE /api/contracts/:id', () => {
    let contractId: string;

    beforeEach(async () => {
      // Create a test contract
      const contract = await db.insert(contracts).values({
        id: '1',
        quoteId: acceptedQuoteId,
        contractNumber: 'CNT-001',
        status: 'pending'
      }).returning();

      contractId = contract[0].id;
    });

    it('should allow manufacturer to delete pending contract', async () => {
      const response = await request(app)
        .delete(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(204);
    });

    it('should not allow customer to delete contract', async () => {
      const response = await request(app)
        .delete(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });

    it('should not allow deleting signed contract', async () => {
      // Update contract to signed status
      await db.update(contracts)
        .set({ status: 'signed' })
        .where(eq(contracts.id, contractId));

      const response = await request(app)
        .delete(`/api/contracts/${contractId}`)
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });
  });
});