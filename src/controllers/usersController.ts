import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, users, UserRole } from '../db/schema';
import { hashPassword, sanitizeUserForResponse } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';
import { UserData } from '../types';

interface UserUpdateAttributes {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  companyName?: string | null;
  profileData?: Record<string, any>;
}

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('Access denied: Admin only', 403);
    }

    const userResults = await db.select().from(users);
    return res.json(
      formatJsonApiResponse(
        userResults.map((user: UserData) => ({
          type: 'users',
          id: user.id,
          attributes: sanitizeUserForResponse(user),
        }))
      )
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get users: ${(error as Error).message}`, 500);
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (req.user?.role !== UserRole.ADMIN && req.user?.id !== id) {
      throw new AppError('Access denied', 403);
    }

    const userResults = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    return res.json(
      formatJsonApiResponse({
        type: 'users',
        id: userResults[0].id,
        attributes: sanitizeUserForResponse(userResults[0]),
      })
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get user: ${(error as Error).message}`, 500);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const attributes: UserUpdateAttributes = req.body.data.attributes;

    // Only admins can update other users or change roles
    if (req.user?.role !== UserRole.ADMIN && (req.user?.id !== id || attributes.role)) {
      throw new AppError('Access denied', 403);
    }

    const userResults = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    
    if (attributes.firstName) updates.firstName = attributes.firstName;
    if (attributes.lastName) updates.lastName = attributes.lastName;
    if (attributes.email) updates.email = attributes.email;
    if (attributes.role) updates.role = attributes.role;
    if (attributes.companyName !== undefined) updates.companyName = attributes.companyName;
    if (attributes.profileData) updates.profileData = JSON.stringify(attributes.profileData);
    
    if (attributes.password) {
      updates.passwordHash = await hashPassword(attributes.password);
    }

    await db.update(users).set(updates).where(eq(users.id, id));
    const updatedUser = await db.select().from(users).where(eq(users.id, id)).limit(1);

    return res.json(
      formatJsonApiResponse({
        type: 'users',
        id: updatedUser[0].id,
        attributes: sanitizeUserForResponse(updatedUser[0]),
      })
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update user: ${(error as Error).message}`, 500);
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== UserRole.ADMIN) {
      throw new AppError('Access denied: Admin only', 403);
    }

    const userResults = await db.select().from(users).where(eq(users.id, id)).limit(1);
    
    if (userResults.length === 0) {
      throw new AppError('User not found', 404);
    }

    await db.delete(users).where(eq(users.id, id));

    return res.status(204).send();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete user: ${(error as Error).message}`, 500);
  }
};