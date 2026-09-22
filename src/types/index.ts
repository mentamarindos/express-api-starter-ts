import { UserRole } from '../db/schema';

// JWT Payload interface
export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// User data interface
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
  documentUrl?: string;
}

// Production Status Input interface
export interface ProductionStatusInput {
  contractId: string;
  status: string;
  notes?: string;
}

// Shared response envelopes (formerly src/interfaces/)
export interface MessageResponse {
  message: string;
}

export interface ErrorResponse {
  message: string;
  stack?: string;
  errors?: unknown[];
}
