import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    errors: [{
      status: '429',
      title: 'Too many requests',
      detail: 'Please try again later'
    }]
  },
  standardHeaders: true,
  legacyHeaders: false,
});