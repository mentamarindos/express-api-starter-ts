import { Router } from 'express';
import * as quotesController from '../controllers/quotesController';
import { validateToken } from '../middlewares/auth';

const router = Router();

router.post('/', validateToken, quotesController.createQuote);
router.get('/', validateToken, quotesController.getQuotes);
router.get('/:id', validateToken, quotesController.getQuoteById);
router.put('/:id', validateToken, quotesController.updateQuote);
router.delete('/:id', validateToken, quotesController.deleteQuote);

export const quotesRoutes = router;