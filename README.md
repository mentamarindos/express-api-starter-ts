// File: src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { quoteRequestsRoutes } from './routes/quoteRequests';
import { quotesRoutes } from './routes/quotes';
import { contractsRoutes } from './routes/contracts';
import { productionStatusRoutes } from './routes/productionStatus';
import { validateToken } from './middleware/auth';
import { initializeDatabase } from './db/schema';

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors()); // Handle CORS
app.use(express.json({ type: 'application/vnd.api+json' })); // JSON:API content type

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', validateToken, usersRoutes);
app.use('/api/quote-requests', validateToken, quoteRequestsRoutes);
app.use('/api/quotes', validateToken, quotesRoutes);
app.use('/api/contracts', validateToken, contractsRoutes);
app.use('/api/production-status', validateToken, productionStatusRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// File: src/db/schema.ts
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, blob, primaryKey } from 'drizzle-orm/sqlite-core';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

// Database client setup
const client = createClient({
  url: process.env.DATABASE_URL || 'file:./db.sqlite',
});

export const db = drizzle(client);

// User roles enum (for type safety)
export enum UserRole {
  CUSTOMER = 'customer',
  MANUFACTURER = 'manufacturer',
  ADMIN = 'admin',
}

// Common timestamps fields
const timestampFields = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
};

// Users table - unified table for all user types
export const users = sqliteTable('users', {
  id: text('id').primaryKey().notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: Object.values(UserRole) }).notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  companyName: text('company_name'),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  postalCode: text('postal_code'),
  country: text('country'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  profileData: text('profile_data', { mode: 'json' }), // Extensible JSON field for additional profile data
  ...timestampFields,
});

// Products - doors and windows types catalog
export const products = sqliteTable('products', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(), // door or window
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestampFields,
});

// Materials catalog
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestampFields,
});

// Opening types catalog
export const openingTypes = sqliteTable('opening_types', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestampFields,
});

// Profile types catalog
export const profileTypes = sqliteTable('profile_types', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestampFields,
});

// Quote requests table
export const quoteRequests = sqliteTable('quote_requests', {
  id: text('id').primaryKey().notNull(),
  customerId: text('customer_id').notNull().references(() => users.id),
  productId: text('product_id').notNull().references(() => products.id),
  materialId: text('material_id').notNull().references(() => materials.id),
  openingTypeId: text('opening_type_id').notNull().references(() => openingTypes.id),
  profileTypeId: text('profile_type_id').notNull().references(() => profileTypes.id),
  width: integer('width').notNull(), // in mm
  height: integer('height').notNull(), // in mm
  quantity: integer('quantity').notNull().default(1),
  comments: text('comments'),
  status: text('status').notNull().default('pending'), // pending, quoted, accepted, rejected, completed
  ...timestampFields,
});

// Quotes table
export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey().notNull(),
  quoteRequestId: text('quote_request_id').notNull().references(() => quoteRequests.id),
  manufacturerId: text('manufacturer_id').notNull().references(() => users.id),
  price: integer('price').notNull(), // in cents
  deliveryTimeInDays: integer('delivery_time_in_days').notNull(),
  validUntil: text('valid_until').notNull(),
  additionalNotes: text('additional_notes'),
  status: text('status').notNull().default('pending'), // pending, accepted, rejected
  ...timestampFields,
});

// Contracts table
export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey().notNull(),
  quoteId: text('quote_id').notNull().references(() => quotes.id),
  contractNumber: text('contract_number').notNull().unique(),
  documentUrl: text('document_url'), // URL or path to the generated contract
  signedDocumentUrl: text('signed_document_url'), // URL or path to the signed and uploaded contract
  signedAt: text('signed_at'),
  status: text('status').notNull().default('pending'), // pending, signed, active, completed
  ...timestampFields,
});

// Production status table
export const productionStatus = sqliteTable('production_status', {
  id: text('id').primaryKey().notNull(),
  contractId: text('contract_id').notNull().references(() => contracts.id),
  status: text('status').notNull(), // ordered, in_production, completed, shipped, delivered
  notes: text('notes'),
  ...timestampFields,
});

// Notifications table
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  relatedEntityType: text('related_entity_type'), // quote_request, quote, contract, production_status
  relatedEntityId: text('related_entity_id'),
  ...timestampFields,
});

// Files table (for contract documents, etc.)
export const files = sqliteTable('files', {
  id: text('id').primaryKey().notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  uploadedById: text('uploaded_by_id').notNull().references(() => users.id),
  relatedEntityType: text('related_entity_type').notNull(), // contract, quote_request, etc.
  relatedEntityId: text('related_entity_id').notNull(),
  ...timestampFields,
});

// Function to initialize the database
export async function initializeDatabase() {
  try {
    // Add any database initialization logic here if needed
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// File: src/types/index.ts
import { UserRole } from '../db/schema';

// JWT Payload interface
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// User data interface (for responses)
export interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyName?: string;
  profileData?: Record<string, any>;
}

// JSON:API Response format
export interface JsonApiResponse<T> {
  data: T;
  included?: any[];
  meta?: Record<string, any>;
}

// JSON:API Error format
export interface JsonApiError {
  errors: {
    status: string;
    title: string;
    detail?: string;
    code?: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
  }[];
}

// Quote Request Input interface
export interface QuoteRequestInput {
  productId: string;
  materialId: string;
  openingTypeId: string;
  profileTypeId: string;
  width: number;
  height: number;
  quantity: number;
  comments?: string;
}

// Quote Input interface
export interface QuoteInput {
  quoteRequestId: string;
  price: number;
  deliveryTimeInDays: number;
  validUntil: string;
  additionalNotes?: string;
}

// Contract Input interface
export interface ContractInput {
  quoteId: string;
  contractNumber: string;
}

// Production Status Input interface
export interface ProductionStatusInput {
  contractId: string;
  status: string;
  notes?: string;
}

// File: src/utils/auth.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload, UserData } from '../types';
import { UserRole } from '../db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePasswords = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (user: {
  id: string;
  email: string;
  role: UserRole;
}): string => {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

export const generateUUID = (): string => {
  return uuidv4();
};

export const sanitizeUserForResponse = (user: any): UserData => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    companyName: user.companyName,
    profileData: user.profileData,
  };
};

// File: src/utils/jsonApiFormatter.ts
import { JsonApiResponse, JsonApiError } from '../types';

export const formatJsonApiResponse = <T>(
  data: T,
  included?: any[],
  meta?: Record<string, any>
): JsonApiResponse<T> => {
  const response: JsonApiResponse<T> = { data };

  if (included && included.length > 0) {
    response.included = included;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};

export const formatJsonApiError = (
  status: string,
  title: string,
  detail?: string,
  code?: string,
  source?: { pointer?: string; parameter?: string }
): JsonApiError => {
  return {
    errors: [
      {
        status,
        title,
        ...(detail && { detail }),
        ...(code && { code }),
        ...(source && { source }),
      },
    ],
  };
};

// File: src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { UserRole } from '../db/schema';
import { formatJsonApiError } from '../utils/jsonApiFormatter';

// Extend Express Request type to include the user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export const validateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json(
          formatJsonApiError(
            '401',
            'Unauthorized',
            'Authentication token is required'
          )
        );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res
      .status(401)
      .json(
        formatJsonApiError(
          '401',
          'Unauthorized',
          'Invalid or expired token'
        )
      );
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json(
          formatJsonApiError(
            '401',
            'Unauthorized',
            'Authentication is required'
          )
        );
    }

    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json(
          formatJsonApiError(
            '403',
            'Forbidden',
            'You do not have permission to access this resource'
          )
        );
    }

    next();
  };
};

// File: src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { formatJsonApiError } from '../utils/jsonApiFormatter';

export class AppError extends Error {
  statusCode: number;
  code?: string;
  source?: { pointer?: string; parameter?: string };

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    source?: { pointer?: string; parameter?: string }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.source = source;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      formatJsonApiError(
        String(err.statusCode),
        err.message,
        err.message,
        err.code,
        err.source
      )
    );
  }

  // Handle Drizzle errors or other specific errors here

  // Default error
  return res.status(500).json(
    formatJsonApiError(
      '500',
      'Internal Server Error',
      process.env.NODE_ENV === 'development' ? err.message : undefined
    )
  );
};

// File: src/controllers/authController.ts
import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, users, UserRole } from '../db/schema';
import {
  hashPassword,
  comparePasswords,
  generateToken,
  generateUUID,
  sanitizeUserForResponse,
} from '../utils/auth';
import { formatJsonApiResponse, formatJsonApiError } from '../utils/jsonApiFormatter';
import { AppError } from '../middleware/errorHandler';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, companyName, ...profileData } = req.body.data.attributes;

    // Validate role
    if (role !== UserRole.CUSTOMER) {
      throw new AppError(
        'Only customer registration is allowed. Manufacturers and admins must be created by an administrator.',
        403
      );
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      throw new AppError('User with this email already exists', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create new user
    const newUser = {
      id: generateUUID(),
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      companyName: companyName || null,
      profileData: Object.keys(profileData).length > 0 ? profileData : null,
      isActive: true,
    };

    await db.insert(users).values(newUser);

    // Generate JWT token
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // Return user data and token
    return res.status(201).json(
      formatJsonApiResponse({
        type: 'users',
        id: newUser.id,
        attributes: sanitizeUserForResponse(newUser),
        meta: { token },
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Registration failed: ${(error as Error).message}`, 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body.data.attributes;

    // Find user
    const userResults = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = userResults[0];

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    // Verify password
    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    // Return user data and token
    return res.status(200).json(
      formatJsonApiResponse({
        type: 'users',
        id: user.id,
        attributes: sanitizeUserForResponse(user),
        meta: { token },
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Login failed: ${(error as Error).message}`, 500);
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userResults = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    return res.status(200).json(
      formatJsonApiResponse({
        type: 'users',
        id: userResults[0].id,
        attributes: sanitizeUserForResponse(userResults[0]),
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get profile: ${(error as Error).message}`, 500);
  }
};

// File: src/controllers/usersController.ts
import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, users, UserRole } from '../db/schema';
import { hashPassword, generateUUID, sanitizeUserForResponse } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middleware/errorHandler';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    // Only admins can list all users
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('Access denied', 403);
    }

    // Support filtering by role
    const roleFilter = req.query.role as UserRole | undefined;
    
    let query = db.select().from(users);
    
    if (roleFilter && Object.values(UserRole).includes(roleFilter)) {
      query = query.where(eq(users.role, roleFilter));
    }

    const allUsers = await query;
    
    return res.status(200).json(
      formatJsonApiResponse(
        allUsers.map(user => ({
          type: 'users',
          id: user.id,
          attributes: sanitizeUserForResponse(user),
        }))
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get users: ${(error as Error).message}`, 500);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Users can view their own profile, admins can view any profile
    if (req.user?.role !== UserRole.ADMIN && req.user?.id !== id) {
      throw new AppError('Access denied', 403);
    }

    const userResults = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    return res.status(200).json(
      formatJsonApiResponse({
        type: 'users',
        id: userResults[0].id,
        attributes: sanitizeUserForResponse(userResults[0]),
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get user: ${(error as Error).message}`, 500);
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    // Only admins can create users (especially manufacturers and admins)
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('Access denied', 403);
    }

    const { email, password, firstName, lastName, role, companyName, ...profileData } = req.body.data.attributes;

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      throw new AppError('User with this email already exists', 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create new user
    const newUser = {
      id: generateUUID(),
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      companyName: companyName || null,
      profileData: Object.keys(profileData).length > 0 ? profileData : null,
      isActive: true,
    };

    await db.insert(users).values(newUser);

    // Return user data
    return res.status(201).json(
      formatJsonApiResponse({
        type: 'users',
        id: newUser.id,
        attributes: sanitizeUserForResponse(newUser),
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to create user: ${(error as Error).message}`, 500);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Users can update their own profile, admins can update any profile
    if (req.user?.role !== UserRole.ADMIN && req.user?.id !== id) {
      throw new AppError('Access denied', 403);
    }

    const userResults = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    const { firstName, lastName, companyName, ...profileData } = req.body.data.attributes;
    
    // Prepare update data
    const updateData: any = {
      firstName,
      lastName,
      companyName: companyName || null,
      updatedAt: new Date().toISOString(),
    };

    // Handle profile data
    if (Object.keys(profileData).length > 0) {
      updateData.profileData = {
        ...userResults[0].profileData,
        ...profileData,
      };
    }

    // Handle password update if provided (only for admin or the user themselves)
    if (req.body.data.attributes.password) {
      updateData.passwordHash = await hashPassword(req.body.data.attributes.password);
    }

    // Only admins can update role or activation status
    if (req.user?.role === UserRole.ADMIN) {
      if (req.body.data.attributes.role) {
        updateData.role = req.body.data.attributes.role;
      }
      
      if (req.body.data.attributes.isActive !== undefined) {
        updateData.isActive = req.body.data.attributes.isActive;
      }
    }

    // Update user
    await db.update(users).set(updateData).where(eq(users.id, id));

    // Get updated user
    const updatedUserResults = await db.select().from(users).where(eq(users.id, id)).limit(1);

    return res.status(200).json(
      formatJsonApiResponse({
        type: 'users',
        id: updatedUserResults[0].id,
        attributes: sanitizeUserForResponse(updatedUserResults[0]),
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to update user: ${(error as Error).message}`, 500);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Only admins can delete users
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('Access denied', 403);
    }

    const userResults = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    // Instead of actually deleting, deactivate the user
    await db.update(users).set({ isActive: false, updatedAt: new Date().toISOString() }).where(eq(users.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to delete user: ${(error as Error).message}`, 500);
  }
};

// File: src/controllers/quoteRequestsController.ts
import { Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db, quoteRequests, users, products, materials, openingTypes, profileTypes, notifications, UserRole } from '../db/schema';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middleware/errorHandler';

export const createQuoteRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Only customers can create quote requests
    if (req.user.role !== UserRole.CUSTOMER) {
      throw new AppError('Only customers can create quote requests', 403);
    }

    const { productId, materialId, openingTypeId, profileTypeId, width, height, quantity, comments } = req.body.data.attributes;

    // Validate required fields
    if (!productId || !materialId || !openingTypeId || !profileTypeId || !width || !height) {
      throw new AppError('Missing required fields', 400);
    }

    // Validate existence of referenced entities
    const [product, material, openingType, profileType] = await Promise.all([
      db.select().from(products).where(eq(products.id, productId)).limit(1),
      db.select().from(materials).where(eq(materials.id, materialId)).limit(1),
      db.select().from(openingTypes).where(eq(openingTypes.id, openingTypeId)).limit(1),
      db.select().from(profileTypes).where(eq(profileTypes.id, profileTypeId)).limit(1),
    ]);

    if (product.length === 0) {
      throw new AppError('Product not found', 404, 'not_found', { pointer: '/data/attributes/productId' });
    }
    if (material.length === 0) {// File: src/controllers/quoteRequestsController.ts (continued)
      throw new AppError('Material not found', 404, 'not_found', { pointer: '/data/attributes/materialId' });
    }
    if (openingType.length === 0) {
      throw new AppError('Opening type not found', 404, 'not_found', { pointer: '/data/attributes/openingTypeId' });
    }
    if (profileType.length === 0) {
      throw new AppError('Profile type not found', 404, 'not_found', { pointer: '/data/attributes/profileTypeId' });
    }

    // Create quote request
    const quoteRequestId = generateUUID();
    const newQuoteRequest = {
      id: quoteRequestId,
      customerId: req.user.id,
      productId,
      materialId,
      openingTypeId,
      profileTypeId,
      width,
      height,
      quantity: quantity || 1,
      comments: comments || null,
      status: 'pending',
    };

    await db.insert(quoteRequests).values(newQuoteRequest);

    // Notify all active manufacturers
    const manufacturers = await db.select().from(users)
      .where(and(
        eq(users.role, UserRole.MANUFACTURER),
        eq(users.isActive, true)
      ));
    
    // Create notifications for manufacturers
    if (manufacturers.length > 0) {
      const notificationsToInsert = manufacturers.map(manufacturer => ({
        id: generateUUID(),
        userId: manufacturer.id,
        title: 'New Quote Request',
        message: `A new quote request (#${quoteRequestId.substring(0, 8)}) has been submitted and is waiting for your review.`,
        isRead: false,
        relatedEntityType: 'quote_request',
        relatedEntityId: quoteRequestId,
      }));

      await db.insert(notifications).values(notificationsToInsert);
    }

    // Get the created quote request with related data
    const result = await db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
    })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, quoteRequestId))
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Failed to retrieve created quote request', 500);
    }

    const { quoteRequest, product: productData, material: materialData, openingType: openingTypeData, profileType: profileTypeData } = result[0];

    // Format response according to JSON:API
    return res.status(201).json(
      formatJsonApiResponse(
        {
          type: 'quote-requests',
          id: quoteRequest.id,
          attributes: {
            width: quoteRequest.width,
            height: quoteRequest.height,
            quantity: quoteRequest.quantity,
            comments: quoteRequest.comments,
            status: quoteRequest.status,
            createdAt: quoteRequest.createdAt,
            updatedAt: quoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: quoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: quoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: quoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: quoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: quoteRequest.profileTypeId }
            }
          }
        },
        [
          {
            type: 'products',
            id: productData.id,
            attributes: {
              name: productData.name,
              category: productData.category,
              description: productData.description,
            }
          },
          {
            type: 'materials',
            id: materialData.id,
            attributes: {
              name: materialData.name,
              description: materialData.description,
            }
          },
          {
            type: 'opening-types',
            id: openingTypeData.id,
            attributes: {
              name: openingTypeData.name,
              description: openingTypeData.description,
            }
          },
          {
            type: 'profile-types',
            id: profileTypeData.id,
            attributes: {
              name: profileTypeData.name,
              description: profileTypeData.description,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to create quote request: ${(error as Error).message}`, 500);
  }
};

export const getQuoteRequests = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    let query = db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
      customer: users,
    })
    .from(quoteRequests)
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .leftJoin(users, eq(quoteRequests.customerId, users.id));

    // Filter based on user role
    if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only see their own quote requests
      query = query.where(eq(quoteRequests.customerId, req.user.id));
    }
    // Manufacturers and admins can see all quote requests

    // Support filtering by status
    if (req.query.status) {
      query = query.where(eq(quoteRequests.status, req.query.status as string));
    }

    // Support sorting
    const sortField = (req.query.sort as string) || '-createdAt'; // Default sort by createdAt descending
    const sortDirection = sortField.startsWith('-') ? 'desc' : 'asc';
    const fieldName = sortField.replace(/^[+-]/, '');
    
    if (fieldName === 'createdAt') {
      query = query.orderBy(sortDirection === 'desc' ? 
        sql`${quoteRequests.createdAt} DESC` : 
        sql`${quoteRequests.createdAt} ASC`);
    }
    // Add other sort fields if needed

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 10;
    const offset = (page - 1) * pageSize;

    const totalCount = await db.select({ count: sql`COUNT(*)` })
      .from(quoteRequests)
      .where(req.user.role === UserRole.CUSTOMER ? eq(quoteRequests.customerId, req.user.id) : undefined);

    query = query.limit(pageSize).offset(offset);

    const results = await query;

    // Format response according to JSON:API
    const data = results.map(({ quoteRequest, product, material, openingType, profileType, customer }) => ({
      type: 'quote-requests',
      id: quoteRequest.id,
      attributes: {
        width: quoteRequest.width,
        height: quoteRequest.height,
        quantity: quoteRequest.quantity,
        comments: quoteRequest.comments,
        status: quoteRequest.status,
        createdAt: quoteRequest.createdAt,
        updatedAt: quoteRequest.updatedAt,
      },
      relationships: {
        customer: {
          data: { type: 'users', id: quoteRequest.customerId }
        },
        product: {
          data: { type: 'products', id: quoteRequest.productId }
        },
        material: {
          data: { type: 'materials', id: quoteRequest.materialId }
        },
        openingType: {
          data: { type: 'opening-types', id: quoteRequest.openingTypeId }
        },
        profileType: {
          data: { type: 'profile-types', id: quoteRequest.profileTypeId }
        }
      }
    }));

    // Included resources
    const included = results.flatMap(({ product, material, openingType, profileType, customer }) => [
      {
        type: 'products',
        id: product.id,
        attributes: {
          name: product.name,
          category: product.category,
          description: product.description,
        }
      },
      {
        type: 'materials',
        id: material.id,
        attributes: {
          name: material.name,
          description: material.description,
        }
      },
      {
        type: 'opening-types',
        id: openingType.id,
        attributes: {
          name: openingType.name,
          description: openingType.description,
        }
      },
      {
        type: 'profile-types',
        id: profileType.id,
        attributes: {
          name: profileType.name,
          description: profileType.description,
        }
      },
      // Only include customer details for admins and manufacturers
      ...(req.user.role !== UserRole.CUSTOMER ? [
        {
          type: 'users',
          id: customer.id,
          attributes: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
          }
        }
      ] : [])
    ]);

    // Filter out duplicate included resources
    const uniqueIncluded = included.filter((item, index, self) =>
      index === self.findIndex(t => t.type === item.type && t.id === item.id)
    );

    return res.status(200).json(
      formatJsonApiResponse(
        data,
        uniqueIncluded,
        {
          totalCount: totalCount[0].count,
          pageCount: Math.ceil(Number(totalCount[0].count) / pageSize),
          currentPage: page,
          pageSize
        }
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get quote requests: ${(error as Error).message}`, 500);
  }
};

export const getQuoteRequestById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    const result = await db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
      customer: users,
    })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .leftJoin(users, eq(quoteRequests.customerId, users.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const { quoteRequest, product, material, openingType, profileType, customer } = result[0];

    // Check permissions
    if (req.user.role === UserRole.CUSTOMER && quoteRequest.customerId !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    // Format response according to JSON:API
    return res.status(200).json(
      formatJsonApiResponse(
        {
          type: 'quote-requests',
          id: quoteRequest.id,
          attributes: {
            width: quoteRequest.width,
            height: quoteRequest.height,
            quantity: quoteRequest.quantity,
            comments: quoteRequest.comments,
            status: quoteRequest.status,
            createdAt: quoteRequest.createdAt,
            updatedAt: quoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: quoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: quoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: quoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: quoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: quoteRequest.profileTypeId }
            }
          }
        },
        [
          {
            type: 'products',
            id: product.id,
            attributes: {
              name: product.name,
              category: product.category,
              description: product.description,
            }
          },
          {
            type: 'materials',
            id: material.id,
            attributes: {
              name: material.name,
              description: material.description,
            }
          },
          {
            type: 'opening-types',
            id: openingType.id,
            attributes: {
              name: openingType.name,
              description: openingType.description,
            }
          },
          {
            type: 'profile-types',
            id: profileType.id,
            attributes: {
              name: profileType.name,
              description: profileType.description,
            }
          },
          // Only include customer details for admins and manufacturers
          ...(req.user.role !== UserRole.CUSTOMER ? [
            {
              type: 'users',
              id: customer.id,
              attributes: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
              }
            }
          ] : [])
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to get quote request: ${(error as Error).message}`, 500);
  }
};

export const updateQuoteRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    // Get the quote request
    const quoteRequestResult = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1);

    if (quoteRequestResult.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const quoteRequest = quoteRequestResult[0];

    // Check permissions
    if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only update their own quote requests and only if they're in 'pending' status
      if (quoteRequest.customerId !== req.user.id) {
        throw new AppError('Access denied', 403);
      }
      
      if (quoteRequest.status !== 'pending') {
        throw new AppError('Cannot update quote request in its current status', 403);
      }
    }

    const { productId, materialId, openingTypeId, profileTypeId, width, height, quantity, comments, status } = req.body.data.attributes;

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    // Customers can update the specifications
    if (req.user.role === UserRole.CUSTOMER) {
      if (productId) updateData.productId = productId;
      if (materialId) updateData.materialId = materialId;
      if (openingTypeId) updateData.openingTypeId = openingTypeId;
      if (profileTypeId) updateData.profileTypeId = profileTypeId;
      if (width) updateData.width = width;
      if (height) updateData.height = height;
      if (quantity) updateData.quantity = quantity;
      if (comments !== undefined) updateData.comments = comments;
    }

    // Only admins can update status
    if (req.user.role === UserRole.ADMIN && status) {
      updateData.status = status;
    }

    // Validate existence of referenced entities if they're being updated
    if (updateData.productId) {
      const product = await db.select().from(products).where(eq(products.id, updateData.productId)).limit(1);
      if (product.length === 0) {
        throw new AppError('Product not found', 404, 'not_found', { pointer: '/data/attributes/productId' });
      }
    }

    if (updateData.materialId) {
      const material = await db.select().from(materials).where(eq(materials.id, updateData.materialId)).limit(1);
      if (material.length === 0) {
        throw new AppError('Material not found', 404, 'not_found', { pointer: '/data/attributes/materialId' });
      }
    }

    if (updateData.openingTypeId) {
      const openingType = await db.select().from(openingTypes).where(eq(openingTypes.id, updateData.openingTypeId)).limit(1);
      if (openingType.length === 0) {
        throw new AppError('Opening type not found', 404, 'not_found', { pointer: '/data/attributes/openingTypeId' });
      }
    }

    if (updateData.profileTypeId) {
      const profileType = await db.select().from(profileTypes).where(eq(profileTypes.id, updateData.profileTypeId)).limit(1);
      if (profileType.length === 0) {
        throw new AppError('Profile type not found', 404, 'not_found', { pointer: '/data/attributes/profileTypeId' });
      }
    }

    // Update the quote request
    await db.update(quoteRequests).set(updateData).where(eq(quoteRequests.id, id));

    // Get the updated quote request
    const result = await db.select({
      quoteRequest: quoteRequests,
      product: products,
      material: materials,
      openingType: openingTypes,
      profileType: profileTypes,
    })
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .leftJoin(products, eq(quoteRequests.productId, products.id))
    .leftJoin(materials, eq(quoteRequests.materialId, materials.id))
    .leftJoin(openingTypes, eq(quoteRequests.openingTypeId, openingTypes.id))
    .leftJoin(profileTypes, eq(quoteRequests.profileTypeId, profileTypes.id))
    .limit(1);

    const { quoteRequest: updatedQuoteRequest, product, material, openingType, profileType } = result[0];

    // Format response according to JSON:API
    return res.status(200).json(
      formatJsonApiResponse(
        {
          type: 'quote-requests',
          id: updatedQuoteRequest.id,
          attributes: {
            width: updatedQuoteRequest.width,
            height: updatedQuoteRequest.height,
            quantity: updatedQuoteRequest.quantity,
            comments: updatedQuoteRequest.comments,
            status: updatedQuoteRequest.status,
            createdAt: updatedQuoteRequest.createdAt,
            updatedAt: updatedQuoteRequest.updatedAt,
          },
          relationships: {
            customer: {
              data: { type: 'users', id: updatedQuoteRequest.customerId }
            },
            product: {
              data: { type: 'products', id: updatedQuoteRequest.productId }
            },
            material: {
              data: { type: 'materials', id: updatedQuoteRequest.materialId }
            },
            openingType: {
              data: { type: 'opening-types', id: updatedQuoteRequest.openingTypeId }
            },
            profileType: {
              data: { type: 'profile-types', id: updatedQuoteRequest.profileTypeId }
            }
          }
        },
        [
          {
            type: 'products',
            id: product.id,
            attributes: {
              name: product.name,
              category: product.category,
              description: product.description,
            }
          },
          {
            type: 'materials',
            id: material.id,
            attributes: {
              name: material.name,
              description: material.description,
            }
          },
          {
            type: 'opening-types',
            id: openingType.id,
            attributes: {
              name: openingType.name,
              description: openingType.description,
            }
          },
          {
            type: 'profile-types',
            id: profileType.id,
            attributes: {
              name: profileType.name,
              description: profileType.description,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to update quote request: ${(error as Error).message}`, 500);
  }
};

export const deleteQuoteRequest = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = req.params;

    // Get the quote request
    const quoteRequestResult = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id)).limit(1);

    if (quoteRequestResult.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const quoteRequest = quoteRequestResult[0];

    // Check permissions
    if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only delete their own quote requests and only if they're in 'pending' status
      if (quoteRequest.customerId !== req.user.id) {
        throw new AppError('Access denied', 403);
      }
      
      if (quoteRequest.status !== 'pending') {
        throw new AppError('Cannot delete quote request in its current status', 403);
      }
    } else if (req.user.role !== UserRole.ADMIN) {
      // Only customers (for their own pending requests) and admins can delete
      throw new AppError('Access denied', 403);
    }

    // Delete the quote request
    await db.delete(quoteRequests).where(eq(quoteRequests.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to delete quote request: ${(error as Error).message}`, 500);
  }
};

// File: src/controllers/quotesController.ts
import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, quotes, quoteRequests, users, notifications, UserRole } from '../db/schema';
import { generateUUID } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middleware/errorHandler';

export const createQuote = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    // Only manufacturers can create quotes
    if (req.user.role !== UserRole.MANUFACTURER) {
      throw new AppError('Only manufacturers can create quotes', 403);
    }

    const { quoteRequestId, price, deliveryTimeInDays, validUntil, additionalNotes } = req.body.data.attributes;

    // Validate required fields
    if (!quoteRequestId || !price || !deliveryTimeInDays || !validUntil) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if the quote request exists and is open for quotes
    const quoteRequestResult = await db.select().from(quoteRequests).where(eq(quoteRequests.id, quoteRequestId)).limit(1);
    
    if (quoteRequestResult.length === 0) {
      throw new AppError('Quote request not found', 404);
    }

    const quoteRequest = quoteRequestResult[0];
    
    if (quoteRequest.status !== 'pending') {
      throw new AppError('Quote request is not open for quotes', 400);
    }

    // Check if the manufacturer has already submitted a quote for this request
    const existingQuote = await db.select()
      .from(quotes)
      .where(
        and(
          eq(quotes.quoteRequestId, quoteRequestId),
          eq(quotes.manufacturerId, req.user.id)
        )
      )
      .limit(1);
    
    if (existingQuote.length > 0) {
      throw new AppError('You have already submitted a quote for this request', 409);
    }

    // Create new quote
    const quoteId = generateUUID();
    const newQuote = {
      id: quoteId,
      quoteRequestId,
      manufacturerId: req.user.id,
      price,
      deliveryTimeInDays,
      validUntil,
      additionalNotes: additionalNotes || null,
      status: 'pending',
    };

    await db.insert(quotes).values(newQuote);

    // Update the quote request status to 'quoted' if it's the first quote
    await db.update(quoteRequests)
      .set({ 
        status: 'quoted',
        updatedAt: new Date().toISOString()
      })
      .where(eq(quoteRequests.id, quoteRequestId));

    // Notify the customer
    await db.insert(notifications).values({
      id: generateUUID(),
      userId: quoteRequest.customerId,
      title: 'New Quote Received',
      message: `You have received a new quote for your request #${quoteRequestId.substring(0, 8)}.`,
      isRead: false,
      relatedEntityType: 'quote',
      relatedEntityId: quoteId,
    });

    // Get the created quote with related data
    const result = await db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
    })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .limit(1);

    if (result.length === 0) {
      throw new AppError('Failed to retrieve created quote', 500);
    }

    const { quote, quoteRequest: updatedQuoteRequest } = result[0];

    // Format response according to JSON:API
    return res.status(201).json(
      formatJsonApiResponse(
        {
          type: 'quotes',
          id: quote.id,
          attributes: {
            price: quote.price,
            deliveryTimeInDays: quote.deliveryTimeInDays,
            validUntil: quote.validUntil,
            additionalNotes: quote.additionalNotes,
            status: quote.status,
            createdAt: quote.createdAt,
            updatedAt: quote.updatedAt,
          },
          relationships: {
            quoteRequest: {
              data: { type: 'quote-requests', id: quote.quoteRequestId }
            },
            manufacturer: {
              data: { type: 'users', id: quote.manufacturerId }
            }
          }
        },
        [
          {
            type: 'quote-requests',
            id: updatedQuoteRequest.id,
            attributes: {
              status: updatedQuoteRequest.status,
              width: updatedQuoteRequest.width,
              height: updatedQuoteRequest.height,
              quantity: updatedQuoteRequest.quantity,
            }
          }
        ]
      )
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to create quote: ${(error as Error).message}`, 500);
  }
};

export const getQuotes = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    let query = db.select({
      quote: quotes,
      quoteRequest: quoteRequests,
      manufacturer: users,
      customer: {
        id: quoteRequests.customerId
      }
    })
    .from(quotes)
    .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
    .leftJoin(users, eq(quotes.manufacturerId, users.id));

    // Filter based on user role
    if (req.user.role === UserRole.MANUFACTURER) {
      // Manufacturers can only see their own quotes
      query = query.where(eq(quotes.manufacturerId, req.user.id));
    } else if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only see quotes for their own quote requests
      query = query.where(eq(quoteRequests.customerId, req.user.id));
    }
    // Admins can see all quotes

    // Support filtering by quote request
    if (req.query.quote_request_id) {
      query = query.where(eq(quotes.quoteRequestId, req.query.quote_request_id as string));
    }

    // Support filtering by status
    if (req.query.status) {
      query = query.where(eq(quotes.status, req.query.status as string));
    }

    // Support pagination
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.page_size as string) || 10;
    const offset = (page - 1) * pageSize;

    // Get total count for pagination
    let countQuery = db.select({ count: sql`COUNT(*)` }).from(quotes);
    
    if (req.user.role === UserRole.MANUFACTURER) {
      countQuery = countQuery.where(eq(quotes.manufacturerId, req.user.id));
    } else if (req.user.role === UserRole.CUSTOMER) {
      countQuery = countQuery
        .leftJoin(quoteRequests, eq(quotes.quoteRequestId, quoteRequests.id))
        .where(eq(quoteRequests.customerId, req.user.id));
    }
    
    if (req.query.quote_request_id) {
      countQuery = countQuery.where(eq(quotes.quoteRequestId, req.query.quote_request_id as

/* not the end, it is pending to complete */