import { Router } from 'express';
import { checkDatabaseHealth } from '../db/init';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const isDbHealthy = await checkDatabaseHealth();
    
    if (!isDbHealthy) {
      return res.status(503).json({
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export const healthRoutes = router;