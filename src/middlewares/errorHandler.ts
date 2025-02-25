import { Request, Response, NextFunction } from 'express';
import { formatJsonApiError } from '../utils/jsonApiFormatter';
import { config } from '../config';

export class AppError extends Error {
  statusCode: number;
  code?: string;
  source?: { pointer: string };

  constructor(message: string, statusCode: number, code?: string, source?: { pointer: string }) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.source = source;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404, 'not_found');
  next(error);
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      formatJsonApiError(
        err.code || err.statusCode.toString(),
        err.message,
        config.nodeEnv === 'development' ? err.stack : undefined,
        err.source
      )
    );
  }

  // Handle Drizzle or other specific errors here if needed

  // Default error
  const statusCode = 500;
  return res.status(statusCode).json(
    formatJsonApiError(
      statusCode.toString(),
      'Internal Server Error',
      config.nodeEnv === 'development' ? err.stack : undefined
    )
  );
};