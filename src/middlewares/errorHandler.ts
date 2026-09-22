import { Request, Response, NextFunction } from 'express';
import { formatJsonApiError } from '../utils/jsonApiFormatter';

export class AppError extends Error {
  statusCode: number;

  code?: string;

  source?: { pointer?: string; parameter?: string };

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    source?: { pointer?: string; parameter?: string }
  ) {
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
  // Express only treats 4-argument functions as error handlers
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      formatJsonApiError(
        String(err.statusCode),
        err.message,
        err.message,
        err.code,
        err.source
      )
    );
  }

  // Default error
  return res.status(500).json(
    formatJsonApiError(
      '500',
      'Internal Server Error',
      process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    )
  );
};