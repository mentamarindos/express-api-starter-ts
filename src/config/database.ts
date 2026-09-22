import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

// Accept both "file:./db.sqlite" and plain paths from DATABASE_URL
const dbPath = (process.env.DATABASE_URL || './database.db').replace(/^file:/, '');

// Initialize database
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);
