import { InferModel } from 'drizzle-orm';
import {
  users,
  products,
  materials,
  openingTypes,
  profileTypes,
  quoteRequests,
  quotes,
  contracts,
  productionStatus,
  notifications
} from '../db/schema';

// Drizzle inferred types
export type User = InferModel<typeof users>;
export type NewUser = InferModel<typeof users, 'insert'>;

export type Product = InferModel<typeof products>;
export type NewProduct = InferModel<typeof products, 'insert'>;

export type Material = InferModel<typeof materials>;
export type NewMaterial = InferModel<typeof materials, 'insert'>;

export type OpeningType = InferModel<typeof openingTypes>;
export type NewOpeningType = InferModel<typeof openingTypes, 'insert'>;

export type ProfileType = InferModel<typeof profileTypes>;
export type NewProfileType = InferModel<typeof profileTypes, 'insert'>;

export type QuoteRequest = InferModel<typeof quoteRequests>;
export type NewQuoteRequest = InferModel<typeof quoteRequests, 'insert'>;

export type Quote = InferModel<typeof quotes>;
export type NewQuote = InferModel<typeof quotes, 'insert'>;

export type Contract = InferModel<typeof contracts>;
export type NewContract = InferModel<typeof contracts, 'insert'>;

export type ProductionStatus = InferModel<typeof productionStatus>;
export type NewProductionStatus = InferModel<typeof productionStatus, 'insert'>;

export type Notification = InferModel<typeof notifications>;
export type NewNotification = InferModel<typeof notifications, 'insert'>;