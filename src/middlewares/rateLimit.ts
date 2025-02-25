import rateLimit from 'express-rate-limit';
import { formatJsonApiError } from '../utils/jsonApiFormatter';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    res.status(429).json(
      formatJsonApiError(
        '429',
        'Too Many Requests',
        'You have exceeded the rate limit. Please try again later.'
      )
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});