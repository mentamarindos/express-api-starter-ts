import { Router } from 'express';
import * as productionStatusController from '../controllers/productionStatusController';
import { validateToken } from '../middlewares/auth';

const router = Router();

router.post('/', validateToken, productionStatusController.createProductionStatus);
router.get('/', validateToken, productionStatusController.getProductionStatuses);
router.get('/:id', validateToken, productionStatusController.getProductionStatusById);
router.put('/:id', validateToken, productionStatusController.updateProductionStatus);
router.delete('/:id', validateToken, productionStatusController.deleteProductionStatus);

export const productionStatusRoutes = router;