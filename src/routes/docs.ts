import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { version } from '../../package.json';

const router = Router();

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API Starter',
      version,
      description: 'API documentation for the Express API Starter project',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  title: { type: 'string' },
                  detail: { type: 'string' },
                  code: { type: 'string' },
                  source: {
                    type: 'object',
                    properties: {
                      pointer: { type: 'string' },
                      parameter: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        UserAttributes: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'customer', 'manufacturer'] },
            companyName: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        QuoteRequestAttributes: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            materialId: { type: 'string' },
            openingTypeId: { type: 'string' },
            profileTypeId: { type: 'string' },
            width: { type: 'integer', minimum: 1 },
            height: { type: 'integer', minimum: 1 },
            quantity: { type: 'integer', minimum: 1 },
            comments: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'quoted', 'accepted', 'rejected', 'completed'] },
          },
        },
        QuoteAttributes: {
          type: 'object',
          properties: {
            quoteRequestId: { type: 'string' },
            price: { type: 'integer', minimum: 0 },
            deliveryTimeInDays: { type: 'integer', minimum: 1 },
            validUntil: { type: 'string', format: 'date-time' },
            additionalNotes: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'accepted', 'rejected'] },
          },
        },
        ContractAttributes: {
          type: 'object',
          properties: {
            quoteId: { type: 'string' },
            contractNumber: { type: 'string' },
            documentUrl: { type: 'string', format: 'uri' },
            signedDocumentUrl: { type: 'string', format: 'uri' },
            signedAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'signed', 'active', 'completed'] },
          },
        },
        ProductionStatusAttributes: {
          type: 'object',
          properties: {
            contractId: { type: 'string' },
            status: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
}));

router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export const docsRoutes = router;