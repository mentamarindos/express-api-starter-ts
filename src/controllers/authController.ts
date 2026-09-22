import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, users, UserRole } from '../db/schema';
import { hashPassword, comparePasswords, generateToken, generateUUID, sanitizeUserForResponse } from '../utils/auth';
import { formatJsonApiResponse } from '../utils/jsonApiFormatter';
import { AppError } from '../middlewares/errorHandler';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, companyName, ...profileData } = req.body.data.attributes;

    if (role !== UserRole.CUSTOMER) {
      throw new AppError(
        'Only customer registration is allowed. Manufacturers and admins must be created by an administrator.',
        403
      );
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      throw new AppError('User with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);
    const newUser = {
      id: generateUUID(),
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      companyName: companyName || null,
      profileData: Object.keys(profileData).length > 0 ? profileData : null,
      isActive: true,
    };

    await db.insert(users).values(newUser);
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return res.status(201).json(
      formatJsonApiResponse({
        type: 'users',
        id: newUser.id,
        attributes: {
          ...sanitizeUserForResponse(newUser),
          token,
        },
      })
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Registration failed: ${(error as Error).message}`, 500);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body.data.attributes;
    const userResults = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (userResults.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = userResults[0];
    const isValidPassword = await comparePasswords(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is inactive', 403);
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
    });

    return res.json(
      formatJsonApiResponse({
        type: 'users',
        id: user.id,
        attributes: {
          ...sanitizeUserForResponse(user),
          token,
        },
      })
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Login failed: ${(error as Error).message}`, 500);
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userResults = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);

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
    throw new AppError(`Failed to get profile: ${(error as Error).message}`, 500);
  }
};