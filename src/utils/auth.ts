import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '../db/schema';
import { JwtPayload, UserData } from '../types';
import { config } from '../config';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePasswords = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (user: {
  id: string;
  email: string;
  role: UserRole;
}): string => {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const secret = config.jwtSecret;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(
    payload as jwt.JwtPayload, 
    secret, 
    { 
      algorithm: 'HS256',
      expiresIn: 86400 // 24 hours in seconds
    }
  );
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};

export const generateUUID = (): string => {
  return uuidv4();
};

export const sanitizeUserForResponse = (user: any): UserData => {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    companyName: user.companyName,
    profileData: user.profileData,
  };
};