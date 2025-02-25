import { Config } from '@libsql/client';
import { config } from './index';

export interface DatabaseConfig {
  url: string;
  authToken?: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const isDev = process.env.NODE_ENV === 'development';

  // For development, use SQLite file
  if (isDev) {
    return {
      url: process.env.DATABASE_URL || 'file:./db.sqlite',
    };
  }

  // For production, require proper database URL and auth token
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required in production');
  }

  return {
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  };
}