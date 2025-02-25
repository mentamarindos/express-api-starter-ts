import { Router } from 'express';
import * as contractsController from '../controllers/contractsController';
import { validateToken } from '../middlewares/auth';

const router = Router();

router.post('/', validateToken, contractsController.createContract);
router.get('/', validateToken, contractsController.getContracts);
router.get('/:id', validateToken, contractsController.getContractById);
router.put('/:id', validateToken, contractsController.updateContract);
router.delete('/:id', validateToken, contractsController.deleteContract);

export const contractsRoutes = router;