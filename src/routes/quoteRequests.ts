import { Router } from 'express';
import * as quoteRequestsController from '../controllers/quoteRequestsController';
import { validateToken } from '../middlewares/auth';

const router = Router();

router.post('/', validateToken, quoteRequestsController.createQuoteRequest);
router.get('/', validateToken, quoteRequestsController.getQuoteRequests);
router.get('/:id', validateToken, quoteRequestsController.getQuoteRequestById);
router.put('/:id', validateToken, quoteRequestsController.updateQuoteRequest);
router.delete('/:id', validateToken, quoteRequestsController.deleteQuoteRequest);

export const quoteRequestsRoutes = router;