import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// The database connection lives in config/database.ts; re-exported here so
// consumers (and tests) can import db and tables from a single module.
export { db } from '../config/database';

export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
  MANUFACTURER = 'manufacturer'
}

// Base timestamp fields for all tables
const timestampFields = {
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
};

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role', { enum: ['admin', 'customer', 'manufacturer'] }).notNull(),
  companyName: text('company_name'),
  profileData: text('profile_data', { mode: 'json' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestampFields,
});

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  ...timestampFields,
});

// Materials table
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ...timestampFields,
});

// Opening types table
export const openingTypes = sqliteTable('opening_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ...timestampFields,
});

// Profile types table
export const profileTypes = sqliteTable('profile_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ...timestampFields,
});

// Quote requests table
export const quoteRequests = sqliteTable('quote_requests', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => users.id),
  productId: text('product_id').notNull().references(() => products.id),
  materialId: text('material_id').notNull().references(() => materials.id),
  openingTypeId: text('opening_type_id').notNull().references(() => openingTypes.id),
  profileTypeId: text('profile_type_id').notNull().references(() => profileTypes.id),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  quantity: integer('quantity').notNull().default(1),
  comments: text('comments'),
  status: text('status', { enum: ['pending', 'quoted', 'accepted', 'rejected', 'completed'] }).notNull().default('pending'),
  ...timestampFields,
});

// Quotes table
export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  quoteRequestId: text('quote_request_id').notNull().references(() => quoteRequests.id),
  manufacturerId: text('manufacturer_id').notNull().references(() => users.id),
  price: integer('price').notNull(),
  deliveryTimeInDays: integer('delivery_time_in_days').notNull(),
  validUntil: text('valid_until').notNull(),
  additionalNotes: text('additional_notes'),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).notNull().default('pending'),
  ...timestampFields,
});

// Contracts table
export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').notNull().references(() => quotes.id),
  contractNumber: text('contract_number').notNull().unique(),
  documentUrl: text('document_url'),
  signedDocumentUrl: text('signed_document_url'),
  signedAt: text('signed_at'),
  status: text('status', { enum: ['pending', 'signed', 'active', 'completed'] }).notNull().default('pending'),
  ...timestampFields,
});

// Production status table
export const productionStatus = sqliteTable('production_status', {
  id: text('id').primaryKey(),
  contractId: text('contract_id').notNull().references(() => contracts.id),
  status: text('status', { enum: ['ordered', 'in_production', 'completed', 'shipped', 'delivered'] }).notNull(),
  notes: text('notes'),
  ...timestampFields,
});

// Notifications table
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  relatedEntityType: text('related_entity_type').notNull(),
  relatedEntityId: text('related_entity_id').notNull(),
  ...timestampFields,
});