import request from 'supertest';
import app from '../src/app';
import { db, users, quoteRequests, quotes, contracts, productionStatus, notifications, products, materials, openingTypes, profileTypes, UserRole } from '../src/db/schema';
import { hashPassword, generateToken } from '../src/utils/auth';

describe('Production Status endpoints', () => {
  let customerToken: string;
  let manufacturerToken: string;
  let signedContractId: string;

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
      status: 'completed'
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

    // Create a signed contract
    const contract = await db.insert(contracts).values({
      id: '1',
      quoteId: quote[0].id,
      contractNumber: 'CNT-001',
      status: 'signed',
      signedAt: new Date().toISOString(),
      signedDocumentUrl: 'https://example.com/signed-contract.pdf'
    }).returning();

    signedContractId = contract[0].id;
  });

  describe('POST /api/production-status', () => {
    it('should create a production status as manufacturer', async () => {
      const response = await request(app)
        .post('/api/production-status')
        .send({
          data: {
            type: 'production-status',
            attributes: {
              contractId: signedContractId,
              status: 'ordered',
              notes: 'Materials ordered'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(201);
      expect(response.body.data.attributes.status).toBe('ordered');
      expect(response.body.data.attributes.notes).toBe('Materials ordered');
    });

    it('should not allow customers to create production status', async () => {
      const response = await request(app)
        .post('/api/production-status')
        .send({
          data: {
            type: 'production-status',
            attributes: {
              contractId: signedContractId,
              status: 'ordered',
              notes: 'Materials ordered'
            }
          }
        })
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/production-status', () => {
    beforeEach(async () => {
      // Create test production statuses
      await db.insert(productionStatus).values([
        {
          id: '1',
          contractId: signedContractId,
          status: 'ordered',
          notes: 'Materials ordered'
        },
        {
          id: '2',
          contractId: signedContractId,
          status: 'in_production',
          notes: 'Production started'
        }
      ]);
    });

    it('should list production statuses for manufacturer', async () => {
      const response = await request(app)
        .get('/api/production-status')
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should list production statuses for customer', async () => {
      const response = await request(app)
        .get('/api/production-status')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by contract ID', async () => {
      const response = await request(app)
        .get(`/api/production-status?contract_id=${signedContractId}`)
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('PUT /api/production-status/:id', () => {
    let statusId: string;

    beforeEach(async () => {
      // Create a test production status
      const status = await db.insert(productionStatus).values({
        id: '1',
        contractId: signedContractId,
        status: 'ordered',
        notes: 'Materials ordered'
      }).returning();

      statusId = status[0].id;
    });

    it('should allow manufacturer to update status', async () => {
      const response = await request(app)
        .put(`/api/production-status/${statusId}`)
        .send({
          data: {
            type: 'production-status',
            attributes: {
              status: 'in_production',
              notes: 'Production started today'
            }
          }
        })
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(200);
      expect(response.body.data.attributes.status).toBe('in_production');
      expect(response.body.data.attributes.notes).toBe('Production started today');
    });

    it('should not allow customers to update status', async () => {
      const response = await request(app)
        .put(`/api/production-status/${statusId}`)
        .send({
          data: {
            type: 'production-status',
            attributes: {
              status: 'completed',
              notes: 'All done'
            }
          }
        })
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/production-status/:id', () => {
    let statusId: string;

    beforeEach(async () => {
      // Create a test production status
      const status = await db.insert(productionStatus).values({
        id: '1',
        contractId: signedContractId,
        status: 'ordered',
        notes: 'Materials ordered'
      }).returning();

      statusId = status[0].id;
    });

    it('should allow manufacturer to delete status', async () => {
      const response = await request(app)
        .delete(`/api/production-status/${statusId}`)
        .set('Authorization', `Bearer ${manufacturerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(204);
    });

    it('should not allow customers to delete status', async () => {
      const response = await request(app)
        .delete(`/api/production-status/${statusId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Accept', 'application/vnd.api+json');

      expect(response.status).toBe(403);
    });
  });
});