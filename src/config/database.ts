import { Config } from '@libsql/client';
import { config } from './index';

export const getDatabaseConfig = (): Config => {
  const { url, authToken } = config.database;

  if (!url) {
    throw new Error('Database URL is required');
  }

  return {
    url,
    ...(authToken && { authToken }),
  };
};