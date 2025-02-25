import { sql } from 'drizzle-orm';
import { db } from './schema';
import { hashPassword } from '../utils/auth';
import { UserRole } from './schema';

export async function initializeDatabase() {
  try {
    // Create initial admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminPasswordHash = await hashPassword(adminPassword);

    await db.insert(users).values({
      id: '1',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
    }).onConflictDoNothing();

    // Initialize product categories
    const productCategories = [
      { id: '1', name: 'Windows', description: 'Various window types' },
      { id: '2', name: 'Doors', description: 'Interior and exterior doors' },
      { id: '3', name: 'Gates', description: 'Entrance and security gates' },
    ];

    await Promise.all(productCategories.map(category =>
      db.insert(products).values(category).onConflictDoNothing()
    ));

    // Initialize materials
    const materials = [
      { id: '1', name: 'Aluminum', description: 'Durable and lightweight' },
      { id: '2', name: 'PVC', description: 'Cost-effective and weather-resistant' },
      { id: '3', name: 'Wood', description: 'Classic and elegant' },
    ];

    await Promise.all(materials.map(material =>
      db.insert(materials).values(material).onConflictDoNothing()
    ));

    // Initialize opening types
    const openingTypes = [
      { id: '1', name: 'Sliding', description: 'Horizontal sliding mechanism' },
      { id: '2', name: 'Hinged', description: 'Traditional swing opening' },
      { id: '3', name: 'Tilt and Turn', description: 'Multi-function opening' },
    ];

    await Promise.all(openingTypes.map(type =>
      db.insert(openingTypes).values(type).onConflictDoNothing()
    ));

    // Initialize profile types
    const profileTypes = [
      { id: '1', name: 'Standard', description: 'Basic profile system' },
      { id: '2', name: 'Thermal Break', description: 'Energy-efficient system' },
      { id: '3', name: 'Premium', description: 'High-end profile system' },
    ];

    await Promise.all(profileTypes.map(type =>
      db.insert(profileTypes).values(type).onConflictDoNothing()
    ));

    console.log('Database initialized successfully with seed data');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Function to check database health
export async function checkDatabaseHealth() {
  try {
    await sql`SELECT 1`.execute();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Export for use in scripts
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed to initialize database:', error);
      process.exit(1);
    });
}