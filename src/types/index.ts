import { UserRole } from '../db/schema';

// JWT Payload interface
export interface JwtPayload {
  id: string;
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
}