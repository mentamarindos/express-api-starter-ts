import { db, users, products, materials, openingTypes, profileTypes, UserRole } from './schema';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../utils/auth';

export async function initializeDatabase() {
  try {
    // Verify database connection
    await db.all(sql`SELECT 1`);

    // Check if admin user exists
    const adminUser = await db.select().from(users).where(sql`email = 'admin@example.com'`).limit(1);

    if (adminUser.length === 0) {
      // Create default admin user
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminPasswordHash = await hashPassword(adminPassword);

      await db.insert(users).values({
        id: '1',  // or use generateUUID() if available
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        passwordHash: adminPasswordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isActive: true,
      });
    }

    const categories = [
      { id: '1', name: 'Windows', category: 'Windows', description: 'Window products' },
      { id: '2', name: 'Doors', category: 'Doors', description: 'Door products' }
    ];

    const materialsList = [
      { id: '1', name: 'Aluminum', description: 'Aluminum material' },
      { id: '2', name: 'PVC', description: 'PVC material' }
    ];

    const openingTypesList = [
      { id: '1', name: 'Sliding', description: 'Sliding opening type' },
      { id: '2', name: 'Hinged', description: 'Hinged opening type' }
    ];

    const profileTypesList = [
      { id: '1', name: 'Standard', description: 'Standard profile' },
      { id: '2', name: 'Premium', description: 'Premium profile' }
    ];

    await Promise.all([
      db.insert(products).values(categories).onConflictDoNothing(),
      db.insert(materials).values(materialsList).onConflictDoNothing(),
      db.insert(openingTypes).values(openingTypesList).onConflictDoNothing(),
      db.insert(profileTypes).values(profileTypesList).onConflictDoNothing()
    ]);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Function to check database health
export async function checkDatabaseHealth() {
  try {
    await db.all(sql`SELECT 1`);
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