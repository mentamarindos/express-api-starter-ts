import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { quoteRequestsRoutes } from './routes/quoteRequests';
import { quotesRoutes } from './routes/quotes';
import { contractsRoutes } from './routes/contracts';
import { productionStatusRoutes } from './routes/productionStatus';
import { validateToken } from './middlewares/auth';
import { apiLimiter } from './middlewares/rateLimit';
import { config } from './config';

const app = express();

// Middleware
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(helmet());
app.use(cors(config.cors));
app.use(compression());
app.use(express.json({ type: 'application/vnd.api+json' }));

// Apply rate limiting to all routes
app.use(apiLimiter);

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', validateToken, usersRoutes);
app.use('/api/quote-requests', validateToken, quoteRequestsRoutes);
app.use('/api/quotes', validateToken, quotesRoutes);
app.use('/api/contracts', validateToken, contractsRoutes);
app.use('/api/production-status', validateToken, productionStatusRoutes);

// Error handling
app.use(errorHandler);

export default app;
