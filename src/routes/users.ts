import { Router } from 'express';
import * as usersController from '../controllers/usersController';
import { validateToken } from '../middlewares/auth';

const router = Router();

router.get('/', validateToken, usersController.getAllUsers);
router.get('/:id', validateToken, usersController.getUserById);
router.put('/:id', validateToken, usersController.updateUser);
router.delete('/:id', validateToken, usersController.deleteUser);

export const usersRoutes = router;